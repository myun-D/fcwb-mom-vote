-- MOM 투표 DB 스키마
-- Supabase SQL Editor에 그대로 붙여넣어 실행하거나 `npm run db:setup`으로 실행합니다.
-- 여러 번 실행해도 안전합니다.

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 20),
  pin_hash text,                                   -- null이면 아직 PIN 미설정(첫 로그인 때 설정)
  is_admin boolean not null default false,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  session_version int not null default 0,          -- PIN 초기화 시 증가 → 기존 로그인 무효화
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 50),
  match_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- 개표(다 같이 한 표씩 보기) 상태
-- reveal_order: 팀 순서 → 팀 안에서는 무작위로 섞은 표 id 목록. null이면 아직 개표 시작 전
-- reveal_pos: 지금까지 공개한 표 수
alter table matches add column if not exists reveal_order uuid[];
alter table matches add column if not exists reveal_pos int not null default 0;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  sort_order int not null,
  unique (match_id, sort_order),
  unique (id, match_id)
);

-- 경기 출전 명단. 인원이 홀수일 때 두 팀 모두에서 뛰는 '중립' 선수는 팀마다 한 줄씩 들어갑니다.
create table if not exists team_players (
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null,
  member_id uuid not null references members(id),
  primary key (match_id, team_id, member_id),
  foreign key (team_id, match_id) references teams(id, match_id) on delete cascade
);

-- 예전 스키마(한 경기에 한 팀만 가능)로 만든 DB를 중립 선수를 허용하도록 바꿉니다.
do $$
begin
  if (select array_length(conkey, 1) from pg_constraint where conname = 'team_players_pkey') = 2 then
    alter table team_players drop constraint team_players_pkey;
    alter table team_players add primary key (match_id, team_id, member_id);
  end if;
end $$;

-- 익명 투표를 위해 "누가 투표했는지"와 "무엇을 찍었는지"를 분리해 저장합니다.
-- participations: 투표 여부만 기록 (중복 투표 방지, 미투표자 확인용)
create table if not exists participations (
  match_id uuid not null references matches(id) on delete cascade,
  member_id uuid not null references members(id),
  primary key (match_id, member_id)
);

-- votes: 투표자 정보와 투표 시각을 저장하지 않습니다. id도 무작위라 순서로 추적할 수 없습니다.
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team_id uuid not null,
  candidate_id uuid not null references members(id),
  reason text not null,                            -- 선택 사항이라 빈 문자열일 수 있습니다
  foreign key (team_id, match_id) references teams(id, match_id) on delete cascade
);

create index if not exists votes_match_idx on votes (match_id);

-- 관리자가 선정한 팀별 최종 MOM
create table if not exists mom_results (
  team_id uuid primary key,
  match_id uuid not null references matches(id) on delete cascade,
  member_id uuid not null references members(id),
  comment text,
  foreign key (team_id, match_id) references teams(id, match_id) on delete cascade
);

-- 투표 제출: 참여 기록과 표를 한 트랜잭션에서 저장하고 모든 규칙을 DB에서 검사합니다.
-- p_votes: [{"team_id": "...", "candidate_id": "...", "reason": "..."}, ...]
create or replace function submit_ballot(p_match_id uuid, p_voter_id uuid, p_votes jsonb)
returns void
language plpgsql
as $$
declare
  v_status text;
  v_team_count int;
  v_vote jsonb;
  v_team uuid;
  v_candidate uuid;
  v_reason text;
  v_seen uuid[] := '{}';
begin
  -- 마감 처리와 동시에 들어온 표가 마감 뒤에 저장되지 않도록 경기 행을 잠급니다.
  select status into v_status from matches where id = p_match_id for share;
  if v_status is null then
    raise exception '경기를 찾을 수 없습니다.';
  end if;
  if v_status <> 'open' then
    raise exception '지금은 투표 기간이 아닙니다.';
  end if;

  if not exists (
    select 1 from team_players where match_id = p_match_id and member_id = p_voter_id
  ) then
    raise exception '이번 경기 출전 선수만 투표할 수 있습니다.';
  end if;

  select count(*) into v_team_count from teams where match_id = p_match_id;
  if jsonb_typeof(p_votes) <> 'array' or jsonb_array_length(p_votes) <> v_team_count then
    raise exception '모든 팀의 MOM을 선택해 주세요.';
  end if;

  insert into participations (match_id, member_id)
  values (p_match_id, p_voter_id)
  on conflict do nothing;
  if not found then
    raise exception '이미 투표하셨습니다.';
  end if;

  for v_vote in select * from jsonb_array_elements(p_votes) loop
    v_team := (v_vote ->> 'team_id')::uuid;
    v_candidate := (v_vote ->> 'candidate_id')::uuid;
    v_reason := btrim(coalesce(v_vote ->> 'reason', ''));

    if v_team is null or v_team = any (v_seen) then
      raise exception '팀마다 한 명씩 선택해 주세요.';
    end if;
    v_seen := v_seen || v_team;

    if v_candidate = p_voter_id then
      raise exception '자기 자신에게는 투표할 수 없습니다.';
    end if;
    if not exists (
      select 1 from team_players
      where match_id = p_match_id and team_id = v_team and member_id = v_candidate
    ) then
      raise exception '선택한 선수가 해당 팀 명단에 없습니다.';
    end if;
    if char_length(v_reason) > 300 then
      raise exception '이유는 300자 이내로 적어 주세요.';
    end if;

    insert into votes (match_id, team_id, candidate_id, reason)
    values (p_match_id, v_team, v_candidate, v_reason);
  end loop;
end;
$$;

-- 앱은 서버에서 DB에 직접 연결합니다(테이블 소유자 권한).
-- RLS를 켜고 정책을 두지 않아 Supabase 공개 API(anon key)로는 어떤 데이터도 읽거나 쓸 수 없게 합니다.
alter table members enable row level security;
alter table matches enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;
alter table participations enable row level security;
alter table votes enable row level security;
alter table mom_results enable row level security;
