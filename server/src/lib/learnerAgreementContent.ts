// Learner Agreement text, sourced verbatim from the HACA Learner Agreement
// document (Main Course / Short Course variants). Kept as structured
// sections (not one HTML blob) so the public agreement page can render them
// as a normal list and the reminder/send emails can reuse the same source
// without duplicating the wording.
//
// The Main and Short variants diverge at multiple, non-contiguous points
// (attendance rules, resource usage, placement/refund/batch-transfer
// sections, section numbering), so each is kept as one full section list
// rather than force-fit into a shared/diff split.

export type CourseType = 'main' | 'short'

export interface AgreementSection {
    heading: string
    body: string[] // one paragraph/bullet per entry
}

const INTRO_SECTIONS: AgreementSection[] = [
    {
        heading: 'Welcome to HACA',
        body: [
            'By joining HACA, you become part of a community that values effort, professionalism, curiosity, and growth. This agreement outlines the expectations, responsibilities, rights, and commitments between you (the learner) and HACA (the institution).',
            'Our promise to you: we will provide industry-grade training, real-world guidance, and a safe, respectful, and growth-oriented environment.',
            'You will show up with effort, integrity, discipline, and ownership over your learning journey.',
            "By signing this agreement and accessing HACA's programs, you acknowledge and agree to all the terms described here.",
            '— Team HACA',
        ],
    },
    {
        heading: 'HACA Learners Admission Form',
        body: [
            '1. Personal Details — Full Name: __________; Date of Birth: ________; Gender: ☐ Male ☐ Female ☐ Other; Contact Number: __________; Email Address: __________; Address: __________',
            '2. Educational Background — Highest Qualification: __________; Institution Name: __________; Year of Passing: ________',
            '3. Course Details — Course Name: __________; Preferred Batch Timing: ☐ Morning ☐ Evening ☐ Weekend; Mode of Study: ☐ Online ☐ Offline',
            '4. Emergency Contact — Name: __________; Relationship: __________; Contact Number: __________',
            '5. Payment Details — Registration Fee Paid: ☐ Yes ☐ No; Payment Mode: ☐ Cash ☐ Bank Transfer ☐ Other (Specify: _______)',
            "6. Identity Proof — Type of Identity Proof: ☐ Aadhaar Card ☐ Passport ☐ Driver's License ☐ Voter ID ☐ Other (Specify: ________); Identity Proof Number: __________; Upload Copy of Identity Proof (if online submission): ☐ Yes ☐ No",
        ],
    },
]

const CLOSING_SECTIONS: AgreementSection[] = [
    {
        heading: 'Section 18: Final Declaration',
        body: [
            'By signing below, you acknowledge that you have read and understood all terms, agree to follow HACA policies, and will uphold the culture and professionalism expected.',
            'I confirm that all the above details are true to my knowledge and I understand any false information can result in termination of my enrollment.',
        ],
    },
]

const MAIN_POLICY_SECTIONS: AgreementSection[] = [
    {
        heading: 'Section 7: Course Structure & Academic Expectations',
        body: [
            '7.1 Class Schedule — Classes run from Monday to Friday for Regular and Evening batches, Saturday and Sunday for Weekend batches, and as per days specified for Hybrid batches. Mentors follow strict timings; punctuality is mandatory.',
            '7.2 Attendance — Minimum 80% attendance is required to qualify for certification, placement eligibility, and access to advanced modules. Missing sessions without prior notice will affect progress.',
            '7.3 Probation Period (First 4 Weeks) — Learners will be evaluated on punctuality, consistency, task completion, behaviour, and effort. Failure may lead to additional coaching, re-alignment, or in rare cases, discontinuation.',
            '7.4 Assignments & Assessments — Every module includes tasks, projects, or assessments. Minimum 80% task completion is required to progress.',
        ],
    },
    {
        heading: 'Section 8: Professional Conduct & Behavioural Expectations',
        body: [
            'HACA treats every learner as a "professional-in-training", not a school student. You are expected to communicate respectfully with peers, mentors, and team members; submit tasks on time; take responsibility for your performance; maintain discipline inside and outside class; and follow instructions from mentors/coaches.',
            'Zero-tolerance behaviours resulting in immediate termination: abusive language, intentional disruption, harassment of any kind, breach of confidentiality, and misrepresentation to clients or companies.',
        ],
    },
    {
        heading: 'Section 9: Resource Usage & Confidentiality',
        body: [
            "9.1 Resource Usage — You may access laptops (if provided), projector/screens, classrooms, shooting equipment, lab systems, and Wi-Fi. Use responsibly, return everything in the same condition, and inform the 'DOP Team' before borrowing equipment.",
            '9.2 Confidentiality — Learners may work with real clients, live projects, sensitive data, or small businesses. You must not share client details, leak projects, share mentor content, upload class recordings, or distribute course material. Violation may lead to immediate removal or legal action.',
        ],
    },
    {
        heading: 'Section 10: Feedback & Communication',
        body: [
            'Valid channels: success@harisandcoacademy.com, your SHO / Coordinator, or your Academic Lead. Verbal conversations will not be considered official complaints or requests.',
        ],
    },
    {
        heading: 'Section 11: Placement Policy',
        body: [
            '11.1 Placement Is a Shared Process — HACA provides opportunities, guidance, and training. Your success depends on skill readiness, consistent effort, professional behaviour, attendance, and portfolio quality. HACA does not guarantee placements — we guarantee support, preparation, and opportunities.',
            '11.2 Placement Eligibility Criteria — To enter the placement pipeline you must complete: all course milestones, 80%+ attendance, and 80%+ task completion (Academics); an approved resume and portfolio, where applicable (Portfolio); and professional communication, discipline, and readiness interviews (Behaviour). Only after meeting these will you be added to the placement pool.',
            'This placement policy does not apply to participants enrolled in short-term courses, crash courses, or upskilling programs.',
        ],
    },
    {
        heading: 'Section 12: Interview & Company Rules',
        body: [
            'Learners must attend interviews on time, inform 24 hours prior if rescheduling, maintain professional conduct, and communicate honestly. Failure to do so may result in removal from active referrals and suspension of placement support.',
        ],
    },
    {
        heading: 'Section 13: Post-placement Rules',
        body: [
            'Learners who leave a job within 3 months without valid reason will be moved to Tier 3 automatically.',
        ],
    },
    {
        heading: 'Section 14: Refund Policy',
        body: [
            'After enrolment till 7 days prior to orientation: a deduction of 10% plus applicable EMI partner commission and other enrollment-related costs will apply.',
            'Within 7 days prior to orientation: a deduction of 30% plus applicable EMI partner commission and other immediate charges will apply.',
            'After orientation: no refund will be provided under any circumstances.',
        ],
    },
    {
        heading: 'Section 15: Batch Transfer Policy',
        body: [
            'Allowed only if the full course fee is paid, and must be requested within 1 month of course commencement. Valid only for medical emergencies with verified proof, or serious personal issues. Only one transfer within 1 year of the official batch transfer request is allowed.',
        ],
    },
    {
        heading: 'Section 16: Legal Terms',
        body: [
            '17.1 Unforeseen Circumstances — HACA is not liable for disruptions caused by natural disasters, technical failures, pandemics, lockdowns, or system outages. HACA is not responsible for the policies or failures of EMI partners, payment gateways, or software platforms.',
            '17.3 Intellectual Property — All course content and creative assets created during the course belong to HACA. Do not copy, share, sell, or distribute.',
            '17.4 Dispute Resolution — All disputes will be handled through arbitration, under Indian law.',
        ],
    },
]

const SHORT_POLICY_SECTIONS: AgreementSection[] = [
    {
        heading: 'Section 7: Course Structure & Academic Expectations',
        body: [
            '7.1 Class Schedule — Classes run from Monday to Friday for Regular and Evening batches, Saturday and Sunday for Weekend batches, and as per days specified for Hybrid batches. Mentors follow strict timings; punctuality is mandatory.',
            '7.2 Attendance — Minimum 80% attendance is required to qualify for certification and access to advanced modules. Missing sessions without prior notice will affect progress.',
            '7.3 Probation Period (First 4 Weeks) — Learners will be evaluated on punctuality, consistency, task completion, behaviour, and effort. Failure may lead to additional coaching, re-alignment, or in rare cases, discontinuation.',
            '7.4 Assignments & Assessments — Every module includes tasks, projects, or assessments. Minimum 80% task completion is required to progress.',
        ],
    },
    {
        heading: 'Section 8: Professional Conduct & Behavioural Expectations',
        body: [
            'HACA treats every learner as a "professional-in-training", not a school student. You are expected to communicate respectfully with peers, mentors, and team members; submit tasks on time; take responsibility for your performance; maintain discipline inside and outside class; and follow instructions from mentors/coaches.',
            'Zero-tolerance behaviours resulting in immediate termination: abusive language, intentional disruption, harassment of any kind, breach of confidentiality, and misrepresentation to clients or companies.',
        ],
    },
    {
        heading: 'Section 9: Confidentiality',
        body: [
            '9.2 Confidentiality — Learners may work with real clients, live projects, sensitive data, or small businesses. You must not share client details, leak projects, share mentor content, upload class recordings, or distribute course material. Violation may lead to immediate removal or legal action.',
        ],
    },
    {
        heading: 'Section 10: Feedback & Communication',
        body: [
            'Valid channels: success@harisandcoacademy.com, your SHO / Coordinator, or your Academic Lead. Verbal conversations will not be considered official complaints or requests.',
        ],
    },
    {
        heading: 'Section 11: Refund Policy',
        body: [
            'After enrolment till 7 days prior to orientation: a deduction of 10% plus applicable EMI partner commission and other enrollment-related costs will apply.',
            'Within 7 days prior to orientation: a deduction of 30% plus applicable EMI partner commission and other immediate charges will apply.',
            'After orientation: no refund will be provided under any circumstances.',
        ],
    },
    {
        heading: 'Section 12: Batch Transfer Policy',
        body: [
            'Allowed only if the full course fee is paid, and must be requested within 1 month of course commencement. Valid only for medical emergencies with verified proof, or serious personal issues. Only one transfer within 1 year of the official batch transfer request is allowed.',
        ],
    },
    {
        heading: 'Section 13: Recorded Session Access',
        body: [
            'Recordings of all live sessions will be available for up to 30 days after graduation.',
        ],
    },
    {
        heading: 'Section 17: Legal Terms',
        body: [
            '17.1 Unforeseen Circumstances — HACA is not liable for disruptions caused by natural disasters, technical failures, pandemics, lockdowns, or system outages. HACA is not responsible for the policies or failures of EMI partners, payment gateways, or software platforms.',
            '17.3 Intellectual Property — All course content and creative assets created during the course belong to HACA. Do not copy, share, sell, or distribute.',
            '17.4 Dispute Resolution — All disputes will be handled through arbitration, under Indian law.',
        ],
    },
]

export function getAgreementSections(courseType: CourseType): AgreementSection[] {
    const policy = courseType === 'main' ? MAIN_POLICY_SECTIONS : SHORT_POLICY_SECTIONS
    return [...INTRO_SECTIONS, ...policy, ...CLOSING_SECTIONS]
}

export function courseTypeLabel(courseType: CourseType): string {
    return courseType === 'main' ? 'Main Course' : 'Short Course'
}

export function getAgreementHtml(courseType: CourseType, studentName: string, batchName: string): string {
    const sections = getAgreementSections(courseType)
    const sectionsHtml = sections
        .map(s => `<h3 style="margin:16px 0 6px;color:#111;">${s.heading}</h3>` +
            s.body.map(p => `<p style="margin:4px 0;color:#374151;line-height:1.5;">${p}</p>`).join(''))
        .join('')
    return `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
            <h2 style="color:#111;">HACA Learner Agreement — ${courseTypeLabel(courseType)}</h2>
            <p style="color:#374151;">Hi ${studentName}, please review the terms below for your batch <strong>${batchName}</strong>.</p>
            ${sectionsHtml}
        </div>
    `
}
