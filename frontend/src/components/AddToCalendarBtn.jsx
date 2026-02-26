import { AddToCalendarButton } from 'add-to-calendar-button-react';

export default function AddToCalendarBtn({ loan }) {
  // If there is no due date, don't render the button
  if (!loan.next_due_date) return null;

  // Format the date for the calendar (must be YYYY-MM-DD)
  const dueDate = new Date(loan.next_due_date);
  const formattedDate = dueDate.toISOString().split('T')[0];

  return (
    <div className="calendar-btn-wrapper">
      <AddToCalendarButton
        name={`Loan Payment: ${loan.member.first_name} ${loan.member.last_name}`}
        description={`Expected Monthly Target: ${loan.monthly_payment} RWF.\nLoan ID: #${loan.id}\nPhone: ${loan.member.phone_number}`}
        startDate={formattedDate}
        startTime="09:00"
        endTime="10:00"
        timeZone="Africa/Kigali"
        options={['Google', 'Apple', 'Outlook.com']}
        label="Add Reminder"
        buttonStyle="default"
        lightMode="dark"
        size="1"
        styleLight="--btn-background: #1e293b; --btn-text: #818cf8; --font: 'DM Sans', sans-serif;"
        styleDark="--btn-background: #1e293b; --btn-text: #818cf8; --font: 'DM Sans', sans-serif;"
      />
    </div>
  );
}