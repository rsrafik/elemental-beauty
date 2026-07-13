-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('member', 'officer', 'treasurer', 'admin');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('rsvped', 'attended', 'absent', 'waitlisted');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "reimbursement_status" AS ENUM ('pending', 'approved', 'denied');

-- CreateEnum
CREATE TYPE "finance_category" AS ENUM ('membership_dues', 'sponsorship', 'grant_funding', 'fundraising', 'supplies', 'venue', 'equipment', 'marketing', 'travel', 'event_costs', 'other');

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "waiver_signed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "members" (
    "user_id" INTEGER NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'member',
    "instagram" TEXT,
    "profile_picture" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "date_joined" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "members_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "labs" (
    "lab_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "description" TEXT,
    "image" TEXT,
    "ingredients" TEXT,
    "equipment" TEXT,
    "safety_note" TEXT,
    "instructions" TEXT,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("lab_id")
);

-- CreateTable
CREATE TABLE "lab_lessons" (
    "lesson_id" SERIAL NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "lab_lessons_pkey" PRIMARY KEY ("lesson_id")
);

-- CreateTable
CREATE TABLE "lab_quiz_questions" (
    "question_id" SERIAL NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "question" TEXT NOT NULL,

    CONSTRAINT "lab_quiz_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "quiz_answer_options" (
    "option_id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quiz_answer_options_pkey" PRIMARY KEY ("option_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "image" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "member_lab" (
    "member_id" INTEGER NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "attendance_status" "attendance_status" NOT NULL DEFAULT 'rsvped',
    "quiz_passed" BOOLEAN,
    "waitlisted_at" TIMESTAMPTZ,

    CONSTRAINT "member_lab_pkey" PRIMARY KEY ("member_id","lab_id")
);

-- CreateTable
CREATE TABLE "member_event" (
    "member_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "attendance_status" "attendance_status" NOT NULL DEFAULT 'rsvped',
    "waitlisted_at" TIMESTAMPTZ,

    CONSTRAINT "member_event_pkey" PRIMARY KEY ("member_id","event_id")
);

-- CreateTable
CREATE TABLE "grants" (
    "grant_id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "amount_granted" DECIMAL(10,2) NOT NULL,
    "date_granted" DATE NOT NULL,
    "expiration_date" DATE,

    CONSTRAINT "grants_pkey" PRIMARY KEY ("grant_id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "reimbursement_id" SERIAL NOT NULL,
    "member_id" INTEGER,
    "explanation" TEXT NOT NULL,
    "amount_requested" DECIMAL(10,2) NOT NULL,
    "category" "finance_category" NOT NULL,
    "status" "reimbursement_status" NOT NULL DEFAULT 'pending',
    "denial_explanation" TEXT,
    "receipt" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("reimbursement_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" SERIAL NOT NULL,
    "type" "transaction_type" NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "finance_category" NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "grant_id" INTEGER,
    "reimbursement_id" INTEGER,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "lab_lessons_lab_id_idx" ON "lab_lessons"("lab_id");

-- CreateIndex
CREATE INDEX "lab_quiz_questions_lab_id_idx" ON "lab_quiz_questions"("lab_id");

-- CreateIndex
CREATE INDEX "quiz_answer_options_question_id_idx" ON "quiz_answer_options"("question_id");

-- CreateIndex
CREATE INDEX "member_lab_lab_id_idx" ON "member_lab"("lab_id");

-- CreateIndex
CREATE INDEX "member_event_event_id_idx" ON "member_event"("event_id");

-- CreateIndex
CREATE INDEX "reimbursements_member_id_idx" ON "reimbursements"("member_id");

-- CreateIndex
CREATE INDEX "reimbursements_status_idx" ON "reimbursements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reimbursement_id_key" ON "transactions"("reimbursement_id");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_grant_id_idx" ON "transactions"("grant_id");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_lessons" ADD CONSTRAINT "lab_lessons_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_quiz_questions" ADD CONSTRAINT "lab_quiz_questions_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answer_options" ADD CONSTRAINT "quiz_answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "lab_quiz_questions"("question_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lab" ADD CONSTRAINT "member_lab_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_lab" ADD CONSTRAINT "member_lab_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_event" ADD CONSTRAINT "member_event_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_event" ADD CONSTRAINT "member_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "grants"("grant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reimbursement_id_fkey" FOREIGN KEY ("reimbursement_id") REFERENCES "reimbursements"("reimbursement_id") ON DELETE RESTRICT ON UPDATE CASCADE;
