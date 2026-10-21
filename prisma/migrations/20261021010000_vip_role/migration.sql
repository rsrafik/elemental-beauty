-- A member who has paid this school year's dues. Same footing as a member in
-- everything they can do; their dues switch it on and off. See syncVipRoles
-- in src/dues.js.
ALTER TYPE "member_role" ADD VALUE 'vip';
