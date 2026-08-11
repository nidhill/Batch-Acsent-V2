// Learner Agreement text, sourced from the HACA Learner Agreement document.
// Kept as structured sections (not one HTML blob) so the public agreement
// page can render them as a normal list and the reminder/send emails can
// reuse the same source without duplicating the wording.

export type CourseType = 'main' | 'short'

export interface AgreementSection {
    heading: string
    body: string[] // one paragraph/bullet per entry
}

const COMMON_SECTIONS: AgreementSection[] = [
    {
        heading: 'Core Institutional Promise',
        body: [
            'HACA commits to delivering industry-grade training, real-world guidance, and a safe, respectful, and growth-oriented environment. Learners must reciprocate with effort, integrity, discipline, and ownership of their educational experience.',
        ],
    },
    {
        heading: 'Admission Requirements',
        body: [
            'Admission requires completion of a standardized form collecting personal details, educational background, course preferences, emergency contacts, payment information, and identity verification.',
        ],
    },
    {
        heading: 'Academic Standards',
        body: [
            'Attendance: minimum 80% required for certification and advancement.',
            'Task Completion: at least 80% completion needed to progress through modules.',
            'Probation Period: the first 4 weeks evaluate punctuality, consistency, task completion, behavior, and effort.',
            'Class Schedule: Monday–Friday for regular/evening batches; weekend batches on Saturday–Sunday.',
        ],
    },
    {
        heading: 'Professional Expectations',
        body: [
            'Students are treated as professionals-in-training. Required behaviors include respectful communication, timely submissions, responsibility, and discipline. Zero-tolerance violations — including abusive language, harassment, confidentiality breaches, and misrepresentation — result in immediate termination.',
        ],
    },
    {
        heading: 'Confidentiality Requirements',
        body: [
            'Learners working with real clients or projects must not share client details, leak projects, share mentor content, upload class recordings, or distribute course material.',
        ],
    },
    {
        heading: 'Financial Policies',
        body: [
            'Refund structure — 7+ days before orientation: 10% deduction plus fees. Within 7 days of orientation: 30% deduction plus charges. Post-orientation: no refunds.',
            'Batch transfers are allowed only with full payment, within one month of commencement, for medical emergencies or serious personal issues.',
        ],
    },
]

const MAIN_ONLY_SECTIONS: AgreementSection[] = [
    {
        heading: 'Placement',
        body: [
            'Main course learners must meet academic, portfolio, and behavioral standards for placement eligibility. HACA provides support, preparation, and opportunities but guarantees no placements. Leaving a job within 3 months of placement results in automatic tier demotion.',
        ],
    },
]

const SHORT_ONLY_SECTIONS: AgreementSection[] = [
    {
        heading: 'Short Course Terms',
        body: [
            'Short courses exclude placement eligibility criteria and post-placement employment rules that apply to main courses.',
            'Recorded sessions remain accessible for 30 days after graduation.',
        ],
    },
]

const CLOSING_SECTIONS: AgreementSection[] = [
    {
        heading: 'Intellectual Property',
        body: [
            'All course content and creative assets created during the program belong to HACA and cannot be copied, shared, sold, or distributed.',
        ],
    },
    {
        heading: 'Dispute Resolution',
        body: [
            'All conflicts are handled through arbitration under Indian law.',
        ],
    },
]

export function getAgreementSections(courseType: CourseType): AgreementSection[] {
    const middle = courseType === 'main' ? MAIN_ONLY_SECTIONS : SHORT_ONLY_SECTIONS
    return [...COMMON_SECTIONS, ...middle, ...CLOSING_SECTIONS]
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
