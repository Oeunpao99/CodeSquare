"""Seed the Backend Foundations track (language + module shells)

Inserts the 'backend-foundations' Language and its six Modules so the track
shows up in every environment. Lesson bodies are filled in by seed_tracks.py
(kept out of the migration to avoid a wall of prose in version control).

Revision ID: a1b2c3d4e5f6
Revises: 6baae3cafe57
Create Date: 2026-08-28 16:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "6baae3cafe57"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SLUG = "backend-foundations"

MODULES = [
    ("Databases & SQL", "Model data in tables and query it with SQL.", 1, "beginner"),
    ("Schema Migrations", "Evolve the database over time with Alembic.", 2, "beginner"),
    ("Building REST APIs", "Serve JSON over HTTP with FastAPI.", 3, "intermediate"),
    ("API Docs & Tooling", "OpenAPI, Swagger UI and testing with Postman.", 4, "intermediate"),
    ("DevOps Foundations", "Containers, environments and CI pipelines.", 5, "intermediate"),
    ("Git & GitHub", "Branching, pull requests and SSH keys.", 6, "beginner"),
]


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO languages (name, slug, icon, description, color)
        SELECT
            'Backend Foundations',
            'backend-foundations',
            '\U0001F5C4',
            'Databases, migrations, REST APIs, DevOps and the Git workflow real teams ship on.',
            '#3B82F6'
        WHERE NOT EXISTS (
            SELECT 1 FROM languages WHERE slug = 'backend-foundations'
        );
        """
    )

    values = ",\n            ".join(
        "('{}', '{}', {}, '{}')".format(
            title.replace("'", "''"), descr.replace("'", "''"), order, diff
        )
        for title, descr, order, diff in MODULES
    )
    op.execute(
        f"""
        INSERT INTO modules (language_id, title, description, "order", difficulty)
        SELECT l.id, m.title, m.descr, m.ord, m.diff
        FROM languages l
        CROSS JOIN (VALUES
            {values}
        ) AS m(title, descr, ord, diff)
        WHERE l.slug = 'backend-foundations'
          AND NOT EXISTS (
              SELECT 1 FROM modules mm WHERE mm.language_id = l.id
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM lessons
        WHERE module_id IN (
            SELECT m.id FROM modules m
            JOIN languages l ON l.id = m.language_id
            WHERE l.slug = 'backend-foundations'
        );
        """
    )
    op.execute(
        """
        DELETE FROM modules
        WHERE language_id IN (
            SELECT id FROM languages WHERE slug = 'backend-foundations'
        );
        """
    )
    op.execute("DELETE FROM languages WHERE slug = 'backend-foundations';")
