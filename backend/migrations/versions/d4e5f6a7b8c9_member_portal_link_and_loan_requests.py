"""add member.user_id portal link + loanrequest workflow table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-16 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch_alter_table → SQLite rebuilds the table (plain ALTER cannot add constraints).
    with op.batch_alter_table('member') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_member_user_id', ['user_id'], unique=True)
        batch_op.create_foreign_key(
            'fk_member_user_id', 'user', ['user_id'], ['id']
        )

    op.create_table(
        'loanrequest',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('monthly_payment', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('purpose', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('requested_at', sa.DateTime(), nullable=False),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
        sa.Column('decided_by', sa.Integer(), nullable=True),
        sa.Column('decision_note', sa.String(length=500), nullable=True),
        sa.Column('loan_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['member.id'], ),
        sa.ForeignKeyConstraint(['loan_id'], ['loan.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_loanrequest_member_id'), 'loanrequest', ['member_id'], unique=False)
    op.create_index(op.f('ix_loanrequest_status'), 'loanrequest', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_loanrequest_status'), table_name='loanrequest')
    op.drop_index(op.f('ix_loanrequest_member_id'), table_name='loanrequest')
    op.drop_table('loanrequest')
    with op.batch_alter_table('member') as batch_op:
        batch_op.drop_constraint('fk_member_user_id', type_='foreignkey')
        batch_op.drop_index('ix_member_user_id')
        batch_op.drop_column('user_id')
