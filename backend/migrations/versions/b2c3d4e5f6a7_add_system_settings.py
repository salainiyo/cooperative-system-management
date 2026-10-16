"""add system_settings table (SMTP config + configurable business rates)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-16 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'systemsettings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_name', sa.String(length=120), nullable=False),
        sa.Column('smtp_email', sa.String(length=254), nullable=True),
        sa.Column('smtp_password_encrypted', sa.String(length=512), nullable=True),
        sa.Column('smtp_host', sa.String(length=254), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False),
        sa.Column('interest_rate', sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column('late_fee_rate', sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column('loan_savings_multiplier', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('systemsettings')
