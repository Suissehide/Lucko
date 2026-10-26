-- Jeu masqué aux joueurs, doublon en attente de fusion (LKO-164)
ALTER TABLE "Game" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
