import logging
import os
import smtplib
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from db.database import engine
from dependancies.dependancies import check_none_env_variable, utc_now
from models.models import Loan

logger = logging.getLogger(__name__)
load_dotenv()

# --- EMAIL SETTINGS ---
# In production, ALWAYS load these from a .env file using os.getenv()
SENDER_EMAIL = check_none_env_variable(os.getenv("SENDER_EMAIL"))
SENDER_PASSWORD = check_none_env_variable(os.getenv("SENDER_PASSWORD"))
ADMIN_EMAIL = check_none_env_variable(os.getenv("ADMIN_EMAIL"))


def send_admin_email(subject: str, body: str):
    """Helper function to send an email via Gmail SMTP"""
    try:
        # 1. Construct the Email
        msg = MIMEMultipart()
        msg["From"] = SENDER_EMAIL
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = subject

        # Attach the text body
        msg.attach(MIMEText(body, "plain"))

        # 2. Connect to Gmail's secure SMTP server
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(SENDER_EMAIL, SENDER_PASSWORD)

        # 3. Send and close
        server.send_message(msg)
        server.quit()

        logger.info(f"Successfully sent email alert to {ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")


async def check_and_send_due_reminders():
    """
    Background job that runs daily to check for upcoming loan payments.
    """
    logger.info("Starting daily check for upcoming loan due dates...")

    with Session(engine) as session:
        statement = (
            select(Loan)
            .where(Loan.status == "active")
            .options(
                selectinload(Loan.payments),  # type: ignore
                selectinload(Loan.member),  # type: ignore
            )
        )
        active_loans = session.exec(statement).all()

        today = utc_now().date()
        warning_window = today + timedelta(days=3)

        loans_due_soon = []

        for loan in active_loans:
            if loan.next_due_date and loan.next_due_date <= warning_window:
                loans_due_soon.append(loan)

        if not loans_due_soon:
            logger.info("No loans are due within the next 3 days.")
            return

        # --- CONSTRUCT THE EMAIL BODY ---
        email_body = f"Hello Admin,\n\nAction Required: There are {len(loans_due_soon)} loans due within the next 3 days:\n\n"

        for loan in loans_due_soon:
            member_name = f"{loan.member.first_name} {loan.member.last_name}"
            # Calculate what they owe right now (Expected installment + any previous late fees)
            amount_due = loan.monthly_payment + loan.accumulated_late_fees
            email_body += f"- {member_name} (Phone: {loan.member.phone_number})\n"
            email_body += f"  Amount Due: ${amount_due}\n"
            email_body += f"  Due Date: {loan.next_due_date}\n\n"

        email_body += (
            "Please follow up with these members.\n\n- Your Loan Management System"
        )

        # --- SEND THE REAL EMAIL ---
        send_admin_email(subject="Action Required: Upcoming Loan Dues", body=email_body)
