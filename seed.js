// Fernway CRM demo — seed data.
// Every person, company, email address and phone number here is fictional.
// Emails use the reserved .example domain; phone numbers use the 555-01xx range.
// Dates are day offsets from the demo's "today" (2026-10-29 unless ?today= overrides it).
//
// The scenario: Acme runs a live 25-seat pilot. The expansion deal is at Proposal.
// The deal cannot move to Negotiation until Acme's security review is complete.
window.FERNWAY_SEED = function buildSeed(today, addDays) {
  const d = (n) => addDays(today, n);
  const at = (n, time) => `${d(n)}T${time}`;

  const team = [
    { name: 'Jamie Lee', title: 'Account executive' },
    { name: 'Riley Brooks', title: 'Solutions engineer' },
    { name: 'Morgan Diaz', title: 'Deal desk' },
  ];
  const user = { name: 'Jamie Lee', email: 'jamie.lee@fernway.example' };

  const accounts = [
    { id: 'acme', name: 'Acme', industry: 'Logistics', location: 'Denver, CO', dealName: 'Acme expansion', licensedSeats: 25, proposedSeats: 40, stage: 'Proposal', decisionDate: d(47), rolloutPlan: '', nextStep: 'Revised quote after the pilot review call', blockers: 'Security questionnaire with Acme IT' },
    { id: 'brightwater', name: 'Brightwater Health', industry: 'Healthcare', location: 'Columbus, OH', dealName: 'Brightwater renewal', licensedSeats: 120, proposedSeats: 120, stage: 'Closed won', decisionDate: d(-60), rolloutPlan: 'All clinics live', nextStep: 'Quarterly business review', blockers: '' },
    { id: 'quarry', name: 'Quarry Systems', industry: 'Manufacturing software', location: 'Austin, TX', dealName: 'Quarry Systems team plan', licensedSeats: 0, proposedSeats: 40, stage: 'Negotiation', decisionDate: d(12), rolloutPlan: 'Single rollout', nextStep: 'Legal review of order form', blockers: '' },
    { id: 'orbit', name: 'Orbit Freight', industry: 'Freight and shipping', location: 'Savannah, GA', dealName: 'Orbit renewal', licensedSeats: 75, proposedSeats: 75, stage: 'Closed won', decisionDate: d(-120), rolloutPlan: '', nextStep: 'Renewal planning', blockers: '' },
    { id: 'lumen', name: 'Lumen Analytics', industry: 'Data services', location: 'Seattle, WA', dealName: 'Lumen trial', licensedSeats: 0, proposedSeats: 18, stage: 'Discovery', decisionDate: d(40), rolloutPlan: '', nextStep: 'Technical deep dive', blockers: '' },
    { id: 'fernhill', name: 'Fernhill Labs', industry: 'Biotech', location: 'Raleigh, NC', dealName: 'Fernhill team plan', licensedSeats: 0, proposedSeats: 30, stage: 'Proposal', decisionDate: d(25), rolloutPlan: '', nextStep: 'Security review', blockers: 'Waiting on security review' },
    { id: 'kestrel', name: 'Kestrel Robotics', industry: 'Robotics', location: 'Pittsburgh, PA', dealName: 'Kestrel new business', licensedSeats: 0, proposedSeats: 60, stage: 'Lead', decisionDate: '', rolloutPlan: '', nextStep: 'Intro call', blockers: '' },
  ];

  const contacts = [
    { id: 'tom-whitfield', name: 'Tom Whitfield', role: 'Procurement Manager', accountId: 'acme', email: 'tom.whitfield@acme.example', phone: '+1 (555) 0177', owner: user.name, status: 'Customer', createdAt: at(-52, '11:30'), updatedAt: at(-16, '10:02') },
    { id: 'daniel-okafor', name: 'Daniel Okafor', role: 'Head of IT', accountId: 'brightwater', email: 'd.okafor@brightwater.example', phone: '+1 (555) 0118', owner: user.name, status: 'Customer', createdAt: at(-210, '14:00'), updatedAt: at(-3, '09:45') },
    { id: 'priya-raman', name: 'Priya Raman', role: 'VP Engineering', accountId: 'quarry', email: 'priya@quarrysystems.example', phone: '+1 (555) 0163', owner: user.name, status: 'Opportunity', createdAt: at(-58, '13:20'), updatedAt: at(-2, '15:10') },
    { id: 'elena-sorensen', name: 'Elena Sorensen', role: 'COO', accountId: 'orbit', email: 'elena.sorensen@orbitfreight.example', phone: '+1 (555) 0109', owner: user.name, status: 'Customer', createdAt: at(-320, '10:00'), updatedAt: at(-6, '11:25') },
    { id: 'marcus-hale', name: 'Marcus Hale', role: 'Engineering Manager', accountId: 'lumen', email: 'marcus.hale@lumen.example', phone: '+1 (555) 0131', owner: 'Riley Brooks', status: 'Lead', createdAt: at(-12, '16:40'), updatedAt: at(-4, '12:00') },
    { id: 'aiko-tanaka', name: 'Aiko Tanaka', role: 'Product Operations Lead', accountId: 'fernhill', email: 'aiko.tanaka@fernhill.example', phone: '+1 (555) 0185', owner: 'Riley Brooks', status: 'Opportunity', createdAt: at(-27, '09:05'), updatedAt: at(-1, '17:30') },
    { id: 'rafael-duarte', name: 'Rafael Duarte', role: 'CTO', accountId: 'kestrel', email: 'rafael@kestrel.example', phone: '+1 (555) 0154', owner: user.name, status: 'Lead', createdAt: at(-5, '08:50'), updatedAt: at(-5, '08:50') },
  ];

  const tasks = [
    { id: 't2', contactId: 'elena-sorensen', title: 'Prepare renewal summary', due: d(0), assignee: 'Jamie Lee', done: false, createdAt: at(-6, '11:25') },
    { id: 't3', contactId: 'daniel-okafor', title: 'Confirm SSO requirements', due: d(4), assignee: 'Jamie Lee', done: false, createdAt: at(-3, '09:45') },
    { id: 't4', contactId: 'priya-raman', title: 'Book onboarding session', due: d(6), assignee: 'Jamie Lee', done: false, createdAt: at(-2, '15:10') },
    { id: 't5', contactId: 'rafael-duarte', title: 'Review security questionnaire', due: d(11), assignee: 'Jamie Lee', done: false, createdAt: at(-5, '08:50') },
    { id: 't6', contactId: 'aiko-tanaka', title: 'Share security review answers', due: d(2), assignee: 'Riley Brooks', done: false, createdAt: at(-1, '17:30') },
  ];

  const activities = [
    { id: 'a8', contactId: 'tom-whitfield', type: 'note', at: at(-16, '10:00'), author: 'Jamie Lee', title: 'Note', body: 'Security review must be complete before any order form.' },
    { id: 'a9', contactId: 'daniel-okafor', type: 'call', at: at(-3, '09:30'), author: 'Jamie Lee', title: 'Check-in call', body: 'Asked for SSO setup details before the next rollout wave.' },
    { id: 'a10', contactId: 'priya-raman', type: 'meeting', at: at(-2, '14:30'), author: 'Jamie Lee', title: 'Order form walkthrough', body: 'Legal is reviewing the order form this week.' },
    { id: 'a11', contactId: 'elena-sorensen', type: 'email', at: at(-6, '11:20'), author: 'Jamie Lee', title: 'Email logged: Renewal timing', body: 'Renewal is due next quarter. Elena wants a usage summary first.' },
  ];

  return { user, team, accounts, contacts, tasks, activities, nextId: 100 };
};
