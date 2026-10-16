"""add savings transaction_type + balance_after

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'savings',
        sa.Column('transaction_type', sa.String(length=12), nullable=False, server_default='deposit'),
    )
    op.add_column(
        'savings',
        sa.Column('balance_after', sa.Numeric(precision=14, scale=2), nullable=True),
    )

    # Backfill: every historical row was a deposit; compute running balances per member.
    conn = op.get_bind()
    members = conn.execute(sa.text("SELECT DISTINCT id FROM member")).fetchall()
    for (member_id,) in members:
        rows = conn.execute(
            sa.text(
                "SELECT id, amount FROM savings WHERE member_id = :mid "
                "ORDER BY created_at ASC, id ASC"
            ),
            {"mid": member_id},
        ).fetchall()
        balance = 0.0
        for row_id, amount in rows:
            balance += float(amount)
            conn.execute(
                sa.text(
                    "UPDATE savings SET balance_after = :bal WHERE id = :rid"
                ),
                {"bal": balance, "rid": row_id},
            )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('savings', 'balance_after')
    op.drop_column('savings', 'transaction_type')
