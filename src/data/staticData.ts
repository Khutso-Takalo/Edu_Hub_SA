// ========== IMAGES ==========
export const IMAGES = {
  hero: 'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379905439_a618dd4b.jpg',
  students: [
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379919040_02b06941.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379930005_253735d4.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379921945_507bb2c2.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379928035_5ee9dcf1.jpg',
  ],
  campuses: [
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379952842_c6bb7642.png',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379960042_2a827374.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379952989_4caea6d2.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379947774_90a2c6ed.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379947350_91a7febf.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379948408_5d4cdb58.jpg',
  ],
  icons: [
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771380028955_210b1bae.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379978855_7e5bfaa6.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379980344_a041f6d2.jpg',
    'https://d64gsuwffb70l.cloudfront.net/69951c53bb844db61a199e8f_1771379980628_38c6a8b0.jpg',
  ],
};

// ========== SUBJECTS ==========
export const SA_SUBJECTS = [
  'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences',
  'Accounting', 'Business Studies', 'Economics', 'Geography', 'History',
  'English Home Language', 'Afrikaans First Additional Language', 'IsiZulu Home Language',
  'Information Technology', 'Computer Applications Technology', 'Engineering Graphics & Design',
  'Life Orientation', 'Tourism', 'Dramatic Arts', 'Visual Arts', 'Music',
];

export const CAREER_INTEREST_OPTIONS = [
  'Technology & IT', 'Healthcare & Medicine', 'Engineering', 'Business & Finance',
  'Education & Teaching', 'Law & Justice', 'Creative Arts & Design', 'Agriculture & Environment',
  'Social Sciences', 'Hospitality & Tourism', 'Media & Communication', 'Science & Research',
  'Public Service', 'Trades & Technical', 'Sports & Recreation',
];

export const PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
];

export const GRADE_LEVELS = [
  'Grade 10', 'Grade 11', 'Grade 12', 'TVET College', 'University', 'Private College',
];

// ========== BURSARIES ==========
export interface Bursary {
  id: string;
  name: string;
  provider: string;
  field: string;
  eligibility: string;
  deadline: string;
  amount: string;
  link: string;
  description: string;
  minAPS?: number;
  provinceEligibility?: string[];
  isGolden?: boolean;
  isSponsored?: boolean;
  sponsorName?: string;
  verificationStatus?: 'verified' | 'unverified';
  needsReview?: boolean;
  verificationSource?: 'official' | 'scraped' | 'community';
  lastVerified?: string;
  freshnessScore?: number;
  linkHealthStatus?: 'healthy' | 'broken';
  consecutiveBrokenChecks?: number;
  quarantineReason?: string;
}

export const bursaries: Bursary[] = [
  { id: 'b1', name: 'Funza Lushaka Bursary', provider: 'Department of Basic Education', field: 'Education', eligibility: 'SA citizens, Grade 12 or enrolled in teaching degree', deadline: '2026-03-31', amount: 'Full cost of study', link: '#', description: 'Covers tuition, accommodation, books and living allowance for students pursuing a teaching qualification at a public university.', minAPS: 26 },
  { id: 'b2', name: 'NSFAS Bursary', provider: 'National Student Financial Aid Scheme', field: 'All Fields', eligibility: 'SA citizens, household income under R350,000', deadline: '2026-01-31', amount: 'Full cost of study', link: '#', description: 'Government-funded financial aid covering tuition, accommodation, transport, books and personal allowance for qualifying students.', minAPS: 0 },
  { id: 'b3', name: 'Sasol Bursary Programme', provider: 'Sasol', field: 'STEM', eligibility: 'SA citizens, Grade 12 with Maths & Science 70%+', deadline: '2026-04-30', amount: 'R120,000/year', link: '#', description: 'Supports students in Chemical Engineering, Mechanical Engineering, Electrical Engineering, Mining Engineering, and related STEM fields.', minAPS: 32 },
  { id: 'b4', name: 'Allan Gray Orbis Foundation Fellowship', provider: 'Allan Gray Orbis Foundation', field: 'Business & Commerce', eligibility: 'SA citizens, strong academic record, entrepreneurial mindset', deadline: '2026-03-15', amount: 'Full cost + stipend', link: '#', description: 'Prestigious fellowship for future entrepreneurs covering full tuition, accommodation, and a personal development programme.', minAPS: 35 },
  { id: 'b5', name: 'Eskom Bursary Scheme', provider: 'Eskom Holdings', field: 'Engineering', eligibility: 'SA citizens, Grade 12 with Maths 65%+ & Science 65%+', deadline: '2026-05-31', amount: 'R100,000/year', link: '#', description: 'Bursary for Electrical, Mechanical, Civil, and Chemical Engineering students at approved South African universities.', minAPS: 30 },
  { id: 'b6', name: 'Discovery Health Bursary', provider: 'Discovery Health', field: 'Healthcare', eligibility: 'SA citizens studying actuarial science, IT, or health sciences', deadline: '2026-02-28', amount: 'R80,000/year', link: '#', description: 'Supports students in health sciences, actuarial science, data science, and IT fields relevant to healthcare innovation.', minAPS: 33 },
  { id: 'b7', name: 'Nedbank Bursary Programme', provider: 'Nedbank', field: 'Business & Finance', eligibility: 'SA citizens, financial need, strong academics', deadline: '2026-04-15', amount: 'R90,000/year', link: '#', description: 'Covers tuition and books for students pursuing degrees in Accounting, Finance, Economics, IT, and Data Science.', minAPS: 30 },
  { id: 'b8', name: 'Anglo American Bursary', provider: 'Anglo American', field: 'Engineering', eligibility: 'SA citizens, Grade 12 Maths & Science 70%+', deadline: '2026-03-31', amount: 'Full cost of study', link: '#', description: 'Mining, Metallurgical, Mechanical, Electrical, and Chemical Engineering bursaries with vacation work opportunities.', minAPS: 32 },
  { id: 'b9', name: 'MTN SA Foundation Bursary', provider: 'MTN SA Foundation', field: 'Technology & IT', eligibility: 'SA citizens, Grade 12 with Maths 60%+', deadline: '2026-05-15', amount: 'R85,000/year', link: '#', description: 'Supports students in Computer Science, Information Systems, Electrical Engineering, and related technology fields.', minAPS: 28 },
  { id: 'b10', name: 'Old Mutual Bursary', provider: 'Old Mutual', field: 'Business & Finance', eligibility: 'SA citizens, financial need, Grade 12 or enrolled', deadline: '2026-04-30', amount: 'R75,000/year', link: '#', description: 'Bursary for Actuarial Science, Finance, Accounting, IT, and Mathematics students at South African universities.', minAPS: 30 },
  { id: 'b11', name: 'Transnet Bursary Programme', provider: 'Transnet', field: 'Engineering', eligibility: 'SA citizens, Grade 12 Maths & Science 60%+', deadline: '2026-06-30', amount: 'R95,000/year', link: '#', description: 'Engineering and logistics bursaries including Civil, Mechanical, Electrical, and Industrial Engineering.', minAPS: 28 },
  { id: 'b12', name: 'Shoprite Bursary', provider: 'Shoprite Holdings', field: 'Business & Commerce', eligibility: 'SA citizens, financial need', deadline: '2026-03-31', amount: 'R60,000/year', link: '#', description: 'Supports students in Retail Management, Supply Chain, IT, Finance, and Food Technology programmes.', minAPS: 24 },
  { id: 'b13', name: 'Department of Agriculture Bursary', provider: 'DALRRD', field: 'Agriculture & Environment', eligibility: 'SA citizens, Grade 12 with Science subjects', deadline: '2026-04-30', amount: 'Full cost of study', link: '#', description: 'Bursary for Agricultural Sciences, Veterinary Science, Food Science, and Environmental Management studies.', minAPS: 26 },
  { id: 'b14', name: 'Vodacom Bursary', provider: 'Vodacom', field: 'Technology & IT', eligibility: 'SA citizens, strong Maths & Science', deadline: '2026-05-31', amount: 'R90,000/year', link: '#', description: 'Technology-focused bursary for Computer Science, Data Science, Cybersecurity, and Telecommunications Engineering.', minAPS: 30 },
  { id: 'b15', name: 'Standard Bank Bursary', provider: 'Standard Bank', field: 'Business & Finance', eligibility: 'SA citizens, Grade 12 or enrolled, financial need', deadline: '2026-03-15', amount: 'R85,000/year', link: '#', description: 'Supports students in Accounting, Finance, Economics, IT, Data Analytics, and Actuarial Science.', minAPS: 30 },
  { id: 'b16', name: 'South African Breweries (SAB) Bursary', provider: 'SAB / AB InBev', field: 'STEM', eligibility: 'SA citizens, Grade 12 Maths 65%+', deadline: '2026-04-15', amount: 'R80,000/year', link: '#', description: 'Bursary for Chemical Engineering, Mechanical Engineering, Food Technology, and Supply Chain Management.', minAPS: 28 },
  { id: 'b17', name: 'DHET TVET Bursary', provider: 'Dept of Higher Education', field: 'All Fields', eligibility: 'SA citizens enrolled at public TVET colleges', deadline: '2026-02-15', amount: 'Full cost of study', link: '#', description: 'Government funding for TVET college students covering tuition, accommodation, transport, and learning materials.', minAPS: 0 },
  { id: 'b18', name: 'Capitec Bursary Programme', provider: 'Capitec Bank', field: 'Technology & IT', eligibility: 'SA citizens, strong academic record in Maths', deadline: '2026-05-31', amount: 'R75,000/year', link: '#', description: 'Supports students in Software Development, Data Engineering, Information Systems, and Applied Mathematics.', minAPS: 28 },
];

// ========== INSTITUTIONS ==========
export interface Institution {
  id: string;
  name: string;
  type: 'University' | 'TVET' | 'Private College';
  location: string;
  province: string;
  website: string;
  courses: string[];
  image: string;
  description: string;
  rating: number;
}

export const institutions: Institution[] = [
  { id: 'i1', name: 'University of the Witwatersrand', type: 'University', location: 'Johannesburg', province: 'Gauteng', website: 'https://www.wits.ac.za', courses: ['Engineering', 'Medicine', 'Law', 'Commerce', 'Science', 'Humanities'], image: '', description: 'One of Africa\'s leading research universities, known for excellence in engineering, medicine, and sciences.', rating: 4.7 },
  { id: 'i2', name: 'University of Cape Town', type: 'University', location: 'Cape Town', province: 'Western Cape', website: 'https://www.uct.ac.za', courses: ['Medicine', 'Engineering', 'Commerce', 'Law', 'Humanities', 'Science'], image: '', description: 'Africa\'s oldest university and consistently ranked as the top university on the continent.', rating: 4.8 },
  { id: 'i3', name: 'University of Pretoria', type: 'University', location: 'Pretoria', province: 'Gauteng', website: 'https://www.up.ac.za', courses: ['Engineering', 'Veterinary Science', 'Agriculture', 'Education', 'Law', 'IT'], image: '', description: 'A leading research-intensive university offering a wide range of undergraduate and postgraduate programmes.', rating: 4.6 },
  { id: 'i4', name: 'Stellenbosch University', type: 'University', location: 'Stellenbosch', province: 'Western Cape', website: 'https://www.sun.ac.za', courses: ['Engineering', 'Agriculture', 'Commerce', 'Science', 'Education', 'Arts'], image: '', description: 'A world-class university known for innovation, research excellence, and beautiful campus setting.', rating: 4.7 },
  { id: 'i5', name: 'University of Johannesburg', type: 'University', location: 'Johannesburg', province: 'Gauteng', website: 'https://www.uj.ac.za', courses: ['Engineering', 'IT', 'Commerce', 'Education', 'Health Sciences', 'Law'], image: '', description: 'A vibrant, multicultural university offering accessible quality education in the heart of Johannesburg.', rating: 4.4 },
  { id: 'i6', name: 'Durban University of Technology', type: 'University', location: 'Durban', province: 'KwaZulu-Natal', website: 'https://www.dut.ac.za', courses: ['Engineering', 'IT', 'Health Sciences', 'Accounting', 'Design', 'Management'], image: '', description: 'A leading university of technology offering career-focused qualifications with strong industry links.', rating: 4.2 },
  { id: 'i7', name: 'Tshwane University of Technology', type: 'University', location: 'Pretoria', province: 'Gauteng', website: 'https://www.tut.ac.za', courses: ['Engineering', 'IT', 'Science', 'Management', 'Arts', 'Agriculture'], image: '', description: 'The largest residential university in South Africa, offering technology-focused programmes.', rating: 4.1 },
  { id: 'i8', name: 'Ekurhuleni East TVET College', type: 'TVET', location: 'Springs', province: 'Gauteng', website: 'https://www.eec.edu.za', courses: ['Electrical Engineering', 'Mechanical Engineering', 'Business Management', 'IT', 'Hospitality'], image: '', description: 'A public TVET college offering NCV and Report 191 programmes with practical skills training.', rating: 3.8 },
  { id: 'i9', name: 'South West Gauteng TVET College', type: 'TVET', location: 'Soweto', province: 'Gauteng', website: 'https://www.swgc.co.za', courses: ['Engineering', 'Business Studies', 'IT', 'Tourism', 'Educare'], image: '', description: 'Serving the Soweto community with quality technical and vocational education programmes.', rating: 3.7 },
  { id: 'i10', name: 'False Bay TVET College', type: 'TVET', location: 'Cape Town', province: 'Western Cape', website: 'https://www.falsebaycollege.co.za', courses: ['Engineering', 'Business', 'IT', 'Hospitality', 'Art & Design'], image: '', description: 'A leading Western Cape TVET college with modern facilities and strong industry partnerships.', rating: 4.0 },
  { id: 'i11', name: 'Rosebank College', type: 'Private College', location: 'Johannesburg', province: 'Gauteng', website: 'https://www.rosebankcollege.co.za', courses: ['Business Management', 'IT', 'Commerce', 'Public Relations', 'Human Resources'], image: '', description: 'A well-established private college offering accredited diplomas and degrees in business and IT.', rating: 3.9 },
  { id: 'i12', name: 'Boston City Campus', type: 'Private College', location: 'Multiple Locations', province: 'Gauteng', website: 'https://www.boston.co.za', courses: ['Business', 'IT', 'Law', 'Education', 'Health', 'Design'], image: '', description: 'One of SA\'s largest private education providers with campuses nationwide and flexible study options.', rating: 3.8 },
  { id: 'i13', name: 'Varsity College', type: 'Private College', location: 'Multiple Locations', province: 'Gauteng', website: 'https://www.varsitycollege.co.za', courses: ['Commerce', 'IT', 'Law', 'Communication', 'Science', 'Social Science'], image: '', description: 'Part of The Independent Institute of Education, offering quality private higher education.', rating: 4.1 },
  { id: 'i14', name: 'CTI Education Group', type: 'Private College', location: 'Multiple Locations', province: 'Gauteng', website: 'https://www.cti.ac.za', courses: ['IT', 'Commerce', 'Creative Arts', 'Law', 'Education', 'Psychology'], image: '', description: 'A Pearson-affiliated private college offering internationally benchmarked qualifications.', rating: 3.9 },
  { id: 'i15', name: 'Sedibeng TVET College', type: 'TVET', location: 'Vereeniging', province: 'Gauteng', website: 'https://www.sedcol.co.za', courses: ['Engineering', 'Business', 'IT', 'Hospitality', 'Safety Management'], image: '', description: 'A Gauteng TVET college providing skills development and vocational training programmes.', rating: 3.6 },
];

// ========== CAREERS ==========
export interface Career {
  id: string;
  name: string;
  field: string;
  description: string;
  demandLevel: 'High' | 'Medium' | 'Low';
  longevityReason: string;
  requiredSubjects: string[];
  minAPS: number;
  exampleCourses: string[];
  recommendedInstitutions: string[];
  salary: string;
  interests: string[];
}

export const careers: Career[] = [
  {
    id: 'c1', name: 'Software Developer', field: 'Technology & IT',
    description: 'Design, build, and maintain software applications and systems. South Africa\'s tech sector is booming with growing demand for developers in fintech, e-commerce, and digital services.',
    demandLevel: 'High', longevityReason: 'Digital transformation across all industries ensures sustained demand. SA\'s tech ecosystem is growing rapidly with companies like Naspers, Takealot, and numerous startups driving innovation.',
    requiredSubjects: ['Mathematics', 'Information Technology', 'Physical Sciences'],
    minAPS: 28, exampleCourses: ['BSc Computer Science', 'BIT Information Technology', 'Diploma in Software Development', 'NCV IT & Computer Science'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Cape Town', 'University of Pretoria', 'Tshwane University of Technology'],
    salary: 'R250,000 - R850,000/year', interests: ['Technology & IT'],
  },
  {
    id: 'c2', name: 'Registered Nurse', field: 'Healthcare',
    description: 'Provide direct patient care, administer treatments, and support healthcare teams. SA faces a critical shortage of nurses, making this a highly in-demand career.',
    demandLevel: 'High', longevityReason: 'Healthcare is essential and SA has a severe nursing shortage. The NHI (National Health Insurance) rollout will create even more nursing positions across public and private sectors.',
    requiredSubjects: ['Life Sciences', 'Mathematics', 'Physical Sciences'],
    minAPS: 26, exampleCourses: ['Bachelor of Nursing', 'Diploma in Nursing', 'Higher Certificate in Auxiliary Nursing'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Cape Town', 'Durban University of Technology'],
    salary: 'R180,000 - R550,000/year', interests: ['Healthcare & Medicine'],
  },
  {
    id: 'c3', name: 'Electrical Engineer', field: 'Engineering',
    description: 'Design and develop electrical systems, from power generation to electronics. Critical for SA\'s energy infrastructure and renewable energy transition.',
    demandLevel: 'High', longevityReason: 'SA\'s energy crisis and transition to renewable energy creates massive demand. Load shedding solutions, solar installations, and smart grid development all need electrical engineers.',
    requiredSubjects: ['Mathematics', 'Physical Sciences'],
    minAPS: 32, exampleCourses: ['BEng Electrical Engineering', 'BTech Electrical Engineering', 'National Diploma Electrical Engineering'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Pretoria', 'Tshwane University of Technology', 'Ekurhuleni East TVET College'],
    salary: 'R300,000 - R900,000/year', interests: ['Engineering'],
  },
  {
    id: 'c4', name: 'Chartered Accountant (CA)', field: 'Business & Finance',
    description: 'Provide financial advisory, auditing, and accounting services. One of the most respected and well-compensated professions in South Africa.',
    demandLevel: 'High', longevityReason: 'Every business needs financial expertise. SA\'s growing economy, regulatory requirements, and international business connections ensure consistent demand for CAs.',
    requiredSubjects: ['Mathematics', 'Accounting'],
    minAPS: 34, exampleCourses: ['BCom Accounting', 'BAcc Accounting Sciences', 'Postgraduate Diploma in Accounting'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Cape Town', 'Stellenbosch University', 'University of Johannesburg'],
    salary: 'R400,000 - R1,500,000/year', interests: ['Business & Finance'],
  },
  {
    id: 'c5', name: 'Data Scientist / Analyst', field: 'Technology & IT',
    description: 'Analyze complex data to help organizations make better decisions. One of the fastest-growing careers globally and in South Africa.',
    demandLevel: 'High', longevityReason: 'Data-driven decision making is becoming essential across all sectors. SA\'s banking, insurance, retail, and government sectors are all investing heavily in data capabilities.',
    requiredSubjects: ['Mathematics', 'Information Technology'],
    minAPS: 30, exampleCourses: ['BSc Data Science', 'BSc Mathematical Statistics', 'BCom Informatics', 'Diploma in Data Analytics'],
    recommendedInstitutions: ['University of Cape Town', 'Stellenbosch University', 'University of Pretoria', 'Varsity College'],
    salary: 'R350,000 - R1,000,000/year', interests: ['Technology & IT', 'Science & Research'],
  },
  {
    id: 'c6', name: 'Civil Engineer', field: 'Engineering',
    description: 'Plan, design, and oversee construction of infrastructure like roads, bridges, and buildings. Essential for SA\'s infrastructure development.',
    demandLevel: 'High', longevityReason: 'SA\'s massive infrastructure backlog and ongoing development projects (housing, transport, water) create sustained demand for civil engineers.',
    requiredSubjects: ['Mathematics', 'Physical Sciences'],
    minAPS: 32, exampleCourses: ['BEng Civil Engineering', 'BTech Civil Engineering', 'National Diploma Civil Engineering'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Cape Town', 'Stellenbosch University', 'Durban University of Technology'],
    salary: 'R280,000 - R850,000/year', interests: ['Engineering'],
  },
  {
    id: 'c7', name: 'Teacher / Educator', field: 'Education',
    description: 'Shape the next generation by teaching in primary or secondary schools. SA has a critical shortage of qualified teachers, especially in STEM subjects.',
    demandLevel: 'High', longevityReason: 'Education is a constitutional right in SA, and the country faces a severe teacher shortage. Maths, Science, and Technology teachers are especially needed in rural and township schools.',
    requiredSubjects: ['English Home Language'],
    minAPS: 24, exampleCourses: ['BEd Foundation Phase', 'BEd Intermediate Phase', 'BEd Senior Phase & FET', 'PGCE'],
    recommendedInstitutions: ['University of Pretoria', 'University of Johannesburg', 'Stellenbosch University'],
    salary: 'R180,000 - R450,000/year', interests: ['Education & Teaching'],
  },
  {
    id: 'c8', name: 'Cybersecurity Specialist', field: 'Technology & IT',
    description: 'Protect organizations from cyber threats and ensure data security. A rapidly growing field as SA faces increasing cybercrime.',
    demandLevel: 'High', longevityReason: 'Cybercrime costs SA billions annually. With POPIA compliance requirements and increasing digital adoption, cybersecurity professionals are in critical demand.',
    requiredSubjects: ['Mathematics', 'Information Technology'],
    minAPS: 28, exampleCourses: ['BSc Computer Science (Cybersecurity)', 'Diploma in Cybersecurity', 'CompTIA Security+', 'Certified Ethical Hacker'],
    recommendedInstitutions: ['University of Johannesburg', 'University of Pretoria', 'Boston City Campus', 'Varsity College'],
    salary: 'R300,000 - R900,000/year', interests: ['Technology & IT'],
  },
  {
    id: 'c9', name: 'Diesel Mechanic / Automotive Technician', field: 'Trades & Technical',
    description: 'Maintain and repair diesel engines and vehicles. A hands-on career with strong demand in SA\'s transport and mining sectors.',
    demandLevel: 'Medium', longevityReason: 'SA\'s mining, logistics, and transport industries rely heavily on diesel machinery. While electric vehicles are growing, diesel mechanics remain essential for decades.',
    requiredSubjects: ['Mathematics', 'Physical Sciences'],
    minAPS: 0, exampleCourses: ['NCV Automotive Repair & Maintenance', 'N1-N6 Diesel Trade', 'Red Seal Diesel Mechanic'],
    recommendedInstitutions: ['Ekurhuleni East TVET College', 'South West Gauteng TVET College', 'False Bay TVET College', 'Sedibeng TVET College'],
    salary: 'R150,000 - R400,000/year', interests: ['Trades & Technical', 'Engineering'],
  },
  {
    id: 'c10', name: 'Pharmacist', field: 'Healthcare',
    description: 'Dispense medications, provide health advice, and ensure safe medicine use. A respected healthcare profession with good earning potential.',
    demandLevel: 'Medium', longevityReason: 'Healthcare demand continues to grow with SA\'s population. Community pharmacies, hospital pharmacies, and pharmaceutical companies all need qualified pharmacists.',
    requiredSubjects: ['Mathematics', 'Physical Sciences', 'Life Sciences'],
    minAPS: 34, exampleCourses: ['BPharm Pharmacy', 'Diploma in Pharmacy (Pharmacy Technician)'],
    recommendedInstitutions: ['University of the Witwatersrand', 'University of Cape Town', 'Tshwane University of Technology'],
    salary: 'R350,000 - R750,000/year', interests: ['Healthcare & Medicine', 'Science & Research'],
  },
  {
    id: 'c11', name: 'Digital Marketer', field: 'Media & Communication',
    description: 'Create and manage online marketing campaigns across social media, search engines, and digital platforms.',
    demandLevel: 'High', longevityReason: 'Every business needs a digital presence. SA\'s growing internet penetration and e-commerce boom means digital marketing skills are increasingly valuable.',
    requiredSubjects: ['English Home Language', 'Business Studies'],
    minAPS: 22, exampleCourses: ['BCom Marketing', 'Diploma in Digital Marketing', 'Certificate in Social Media Marketing'],
    recommendedInstitutions: ['Varsity College', 'Boston City Campus', 'Rosebank College', 'University of Johannesburg'],
    salary: 'R200,000 - R600,000/year', interests: ['Media & Communication', 'Creative Arts & Design', 'Business & Finance'],
  },
  {
    id: 'c12', name: 'Renewable Energy Technician', field: 'Engineering',
    description: 'Install, maintain, and repair solar panels, wind turbines, and other renewable energy systems.',
    demandLevel: 'High', longevityReason: 'SA\'s energy crisis and commitment to renewable energy through the IRP 2019 creates massive growth. Solar installations alone are expected to triple by 2030.',
    requiredSubjects: ['Mathematics', 'Physical Sciences'],
    minAPS: 20, exampleCourses: ['NCV Electrical Infrastructure Construction', 'Diploma in Renewable Energy', 'Solar PV Installation Certificate'],
    recommendedInstitutions: ['False Bay TVET College', 'Ekurhuleni East TVET College', 'Tshwane University of Technology'],
    salary: 'R180,000 - R450,000/year', interests: ['Engineering', 'Agriculture & Environment', 'Trades & Technical'],
  },
];

// ========== PAST PAPERS ==========
export interface PastPaper {
  id: string;
  subject: string;
  grade: string;
  year: string;
  examBoard: 'DBE' | 'IEB';
  paperNumber: string;
  type: 'Question Paper' | 'Memo';
  link: string;
}

export const pastPapers: PastPaper[] = [
  { id: 'pp1', subject: 'Mathematics', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp2', subject: 'Mathematics', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Memo', link: '#' },
  { id: 'pp3', subject: 'Mathematics', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Question Paper', link: '#' },
  { id: 'pp4', subject: 'Mathematics', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Memo', link: '#' },
  { id: 'pp5', subject: 'Physical Sciences', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp6', subject: 'Physical Sciences', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Memo', link: '#' },
  { id: 'pp7', subject: 'Physical Sciences', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Question Paper', link: '#' },
  { id: 'pp8', subject: 'Life Sciences', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp9', subject: 'Life Sciences', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Question Paper', link: '#' },
  { id: 'pp10', subject: 'Accounting', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp11', subject: 'Accounting', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Memo', link: '#' },
  { id: 'pp12', subject: 'English Home Language', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp13', subject: 'English Home Language', grade: 'Grade 12', year: '2025', examBoard: 'IEB', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp14', subject: 'Mathematics', grade: 'Grade 11', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp15', subject: 'Mathematics', grade: 'Grade 11', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Question Paper', link: '#' },
  { id: 'pp16', subject: 'Physical Sciences', grade: 'Grade 11', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp17', subject: 'Mathematics', grade: 'Grade 12', year: '2024', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp18', subject: 'Mathematics', grade: 'Grade 12', year: '2024', examBoard: 'DBE', paperNumber: 'Paper 2', type: 'Question Paper', link: '#' },
  { id: 'pp19', subject: 'Mathematics', grade: 'Grade 12', year: '2024', examBoard: 'IEB', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp20', subject: 'Physical Sciences', grade: 'Grade 12', year: '2024', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp21', subject: 'Business Studies', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp22', subject: 'Economics', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp23', subject: 'Geography', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp24', subject: 'History', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp25', subject: 'Information Technology', grade: 'Grade 12', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp26', subject: 'Mathematics', grade: 'Grade 10', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
  { id: 'pp27', subject: 'Life Sciences', grade: 'Grade 11', year: '2025', examBoard: 'DBE', paperNumber: 'Paper 1', type: 'Question Paper', link: '#' },
];

// ========== RESOURCES / GUIDES ==========
export interface Resource {
  id: string;
  title: string;
  category: 'Transition Guide' | 'Study Tips' | 'Career Advice' | 'Financial Aid';
  description: string;
  content: string;
  readTime: string;
}

export const resources: Resource[] = [
  {
    id: 'r1', title: 'How to Read a University Prospectus', category: 'Transition Guide', readTime: '5 min',
    description: 'A step-by-step guide to understanding university prospectuses and making informed choices about your studies.',
    content: `A prospectus is your roadmap to understanding what a university offers. Here's how to read one effectively:\n\n**1. Start with Admission Requirements**\nLook for the minimum APS score, required subjects, and any additional requirements like NBTs (National Benchmark Tests). Each faculty will have different requirements.\n\n**2. Understand the Programme Structure**\nCheck how many years the degree takes, what modules you'll study each year, and whether there are electives or specialisations available.\n\n**3. Check Application Deadlines**\nMost SA universities close applications between June-September for the following year. Don't miss these dates!\n\n**4. Look at Fees and Financial Aid**\nThe prospectus should outline tuition fees, residence costs, and available bursaries or financial aid options.\n\n**5. Campus Life and Support**\nCheck what student support services are available: tutoring, counselling, career guidance, and student organisations.`,
  },
  {
    id: 'r2', title: 'Understanding NQF Levels in South Africa', category: 'Transition Guide', readTime: '4 min',
    description: 'Learn what NQF levels mean and how they affect your qualification choices and career prospects.',
    content: `The National Qualifications Framework (NQF) is South Africa's system for classifying qualifications. Understanding it helps you plan your education path.\n\n**NQF Level 1:** Grade 9 / ABET Level 4\n**NQF Level 2-4:** Grade 10-12 / NCV Level 2-4 (TVET)\n**NQF Level 5:** Higher Certificates / NCV Level 5\n**NQF Level 6:** Diplomas / Advanced Certificates\n**NQF Level 7:** Bachelor's Degrees / BTech\n**NQF Level 8:** Honours / Postgrad Diplomas\n**NQF Level 9:** Master's Degrees\n**NQF Level 10:** Doctoral Degrees\n\n**Why It Matters:**\n- Employers use NQF levels to set job requirements\n- Higher NQF levels generally lead to higher salaries\n- You can progress through levels step by step\n- TVET qualifications (NQF 2-4) can lead to university entry`,
  },
  {
    id: 'r3', title: 'What to Expect in Your First Year at University', category: 'Transition Guide', readTime: '6 min',
    description: 'Prepare yourself for the transition from high school to university with this comprehensive guide.',
    content: `University is a big change from high school. Here's what to expect:\n\n**Academic Differences:**\n- Lectures can have 200+ students — you're responsible for your own learning\n- You'll have fewer contact hours but more self-study time\n- Assignments and exams carry more weight\n- Nobody will chase you for homework\n\n**Time Management:**\n- Create a weekly schedule including lectures, study time, and breaks\n- Use the university's online learning platform (like Blackboard or Moodle)\n- Join study groups early\n\n**Social Life:**\n- Orientation week (O-Week) is crucial — attend everything\n- Join societies and clubs related to your interests\n- Build a support network of friends in your programme\n\n**Financial Tips:**\n- Budget your allowance carefully\n- Buy second-hand textbooks or use the library\n- Apply for NSFAS or bursaries before the deadline\n\n**Mental Health:**\n- It's normal to feel overwhelmed at first\n- Use campus counselling services if needed\n- Stay connected with family and friends back home`,
  },
  {
    id: 'r4', title: 'TVET vs University: Which Path is Right for You?', category: 'Career Advice', readTime: '5 min',
    description: 'Compare TVET colleges and universities to find the best educational path for your goals.',
    content: `Both TVETs and universities offer valuable qualifications. Here's how to choose:\n\n**TVET Colleges:**\n- Focus on practical, hands-on skills\n- Shorter programmes (6 months to 3 years)\n- Lower fees (often covered by NSFAS/DHET bursaries)\n- NCV and NATED (N1-N6) programmes\n- Direct pathway to employment in trades\n- Great for: Engineering, Hospitality, IT, Business\n\n**Universities:**\n- Focus on theory and research\n- Longer programmes (3-6 years)\n- Higher fees but more bursary options\n- Degrees, diplomas, and certificates\n- Required for certain professions (medicine, law, engineering)\n- Great for: Professional careers, research, academia\n\n**Key Considerations:**\n1. What career do you want? Some require a degree\n2. What are your current marks? Universities have higher entry requirements\n3. Do you prefer practical or theoretical learning?\n4. What can you afford? TVET is generally more affordable\n5. You can always bridge from TVET to university later!`,
  },
  {
    id: 'r5', title: 'How to Calculate Your APS Score', category: 'Study Tips', readTime: '3 min',
    description: 'Learn how to calculate your Admission Point Score (APS) and what it means for university applications.',
    content: `Your APS (Admission Point Score) is used by most SA universities to determine if you qualify for admission.\n\n**How to Calculate:**\nEach subject mark converts to points:\n- 80-100% = 7 points\n- 70-79% = 6 points\n- 60-69% = 5 points\n- 50-59% = 4 points\n- 40-49% = 3 points\n- 30-39% = 2 points\n- 0-29% = 1 point\n\n**Important Notes:**\n- Life Orientation is usually counted as half or excluded\n- Add up your best 6 subjects (excluding LO) for your APS\n- Maximum APS is 42 (6 subjects × 7 points)\n- Different universities may calculate slightly differently\n\n**Typical APS Requirements:**\n- Engineering: 32-38\n- Medicine: 36-42\n- Commerce: 28-34\n- Humanities: 24-30\n- Education: 24-28\n- TVET Colleges: No APS required (Grade 9 minimum)`,
  },
  {
    id: 'r6', title: 'Top Study Tips for Matric Success', category: 'Study Tips', readTime: '4 min',
    description: 'Proven study strategies to help you achieve your best results in the NSC examinations.',
    content: `Matric is a marathon, not a sprint. Here are proven strategies:\n\n**1. Start Early**\nBegin revising at least 3 months before exams. Create a study timetable that covers all subjects.\n\n**2. Use Past Papers**\nPast papers are your best study tool. Do at least 5 years of past papers per subject. Time yourself!\n\n**3. Active Recall**\nDon't just read notes — test yourself. Cover your notes and try to recall information from memory.\n\n**4. Study Groups**\nForm study groups of 3-4 people. Teaching others helps you learn better.\n\n**5. Take Care of Yourself**\n- Sleep 7-8 hours per night\n- Eat nutritious meals\n- Exercise regularly\n- Take breaks every 45-60 minutes\n\n**6. Focus on Weak Areas**\nSpend more time on subjects/topics where you score lowest. Don't just study what you already know.\n\n**7. Use Multiple Resources**\nTextbooks, past papers, YouTube tutorials (like Mindset Learn), study guides — use everything available.`,
  },
  {
    id: 'r7', title: 'How to Apply for NSFAS: Step by Step', category: 'Financial Aid', readTime: '5 min',
    description: 'Complete guide to applying for NSFAS funding for your tertiary education.',
    content: `NSFAS (National Student Financial Aid Scheme) provides funding for students who can't afford tertiary education.\n\n**Who Qualifies:**\n- South African citizen\n- Household income under R350,000/year\n- Enrolled or planning to enrol at a public university or TVET college\n- SASSA grant recipients automatically qualify\n\n**How to Apply:**\n1. Visit myNSFAS.org.za\n2. Create an account with your ID number\n3. Complete the online application form\n4. Upload required documents (ID, proof of income, consent form)\n5. Submit before the deadline (usually September-January)\n\n**What NSFAS Covers:**\n- Tuition fees\n- Accommodation (on or off campus)\n- Transport allowance\n- Book allowance\n- Personal/living allowance\n\n**Important Tips:**\n- Apply as early as possible\n- Keep copies of all documents\n- Check your application status regularly\n- Appeal if your application is rejected\n- NSFAS now converts to a bursary (no repayment needed!)`,
  },
  {
    id: 'r8', title: 'Building Your First CV as a Student', category: 'Career Advice', readTime: '4 min',
    description: 'Create a professional CV even with limited work experience using these practical tips.',
    content: `Even without work experience, you can create an impressive CV:\n\n**Structure:**\n1. **Personal Details:** Name, contact info, location\n2. **Personal Statement:** 2-3 sentences about your goals and strengths\n3. **Education:** School/institution, subjects, expected completion date\n4. **Skills:** Computer skills, languages, soft skills\n5. **Achievements:** Awards, leadership roles, community service\n6. **References:** Teachers, community leaders, mentors\n\n**Tips for Students:**\n- Include volunteer work and community involvement\n- List school leadership positions (prefect, class rep, sports captain)\n- Mention relevant coursework or projects\n- Include any certificates (computer literacy, first aid, etc.)\n- Keep it to 1-2 pages maximum\n\n**Common Mistakes to Avoid:**\n- Don't include your photo (unless requested)\n- Don't use an unprofessional email address\n- Don't lie about your qualifications\n- Don't include personal information like ID number\n- Proofread carefully — spelling errors look unprofessional`,
  },
];

// ========== HELPER FUNCTIONS ==========
export function calculateAPS(subjects: { name: string; mark: number }[]): number {
  const nonLO = subjects.filter(s => s.name !== 'Life Orientation');
  const sorted = [...nonLO].sort((a, b) => b.mark - a.mark).slice(0, 6);
  return sorted.reduce((total, s) => {
    if (s.mark >= 80) return total + 7;
    if (s.mark >= 70) return total + 6;
    if (s.mark >= 60) return total + 5;
    if (s.mark >= 50) return total + 4;
    if (s.mark >= 40) return total + 3;
    if (s.mark >= 30) return total + 2;
    return total + 1;
  }, 0);
}

export function getCareerRecommendations(
  subjects: { name: string; mark: number }[],
  interests: string[],
  apsScore: number
): Career[] {
  type CareerRecommendation = Career & { matchScore: number };

  return careers
    .filter((career) => career.name.trim().length > 0 && career.field.trim().length > 0 && career.description.trim().length > 0)
    .map(career => {
      let score = 0;
      // Interest match
      const interestMatch = career.interests.some(i => interests.includes(i));
      if (interestMatch) score += 40;
      // Subject match
      const subjectNames = subjects.map(s => s.name);
      const subjectMatch = career.requiredSubjects.filter(rs => subjectNames.includes(rs)).length;
      score += subjectMatch * 15;
      // APS match
      if (apsScore >= career.minAPS) score += 20;
      else if (apsScore >= career.minAPS - 4) score += 10;
      // Demand bonus
      if (career.demandLevel === 'High') score += 10;
      return { ...career, matchScore: score } as CareerRecommendation;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}
