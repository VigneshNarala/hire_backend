// Comprehensive skill database
const SKILLS_DATABASE = {
    programming: ['JavaScript', 'Python', 'Java', 'C++', 'C#', 'TypeScript', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP', 'Scala', 'R', 'MATLAB'],
    frontend: ['React', 'Angular', 'Vue.js', 'HTML', 'CSS', 'Sass', 'Bootstrap', 'Tailwind', 'Next.js', 'Redux', 'jQuery', 'Webpack'],
    backend: ['Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'ASP.NET', 'Laravel', 'FastAPI', 'GraphQL', 'REST API'],
    database: ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Cassandra', 'DynamoDB', 'Oracle', 'SQL Server', 'Firebase', 'Elasticsearch'],
    cloud: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Lambda', 'EC2', 'S3', 'CloudFormation'],
    aiml: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'NLP', 'Computer Vision', 'Deep Learning', 'Machine Learning', 'Neural Networks', 'OpenCV'],
    devops: ['Jenkins', 'GitLab CI', 'CircleCI', 'Ansible', 'Chef', 'Puppet', 'Prometheus', 'Grafana', 'ELK Stack'],
    mobile: ['React Native', 'Flutter', 'iOS', 'Android', 'Xamarin', 'Ionic'],
    tools: ['Git', 'Jira', 'Confluence', 'Postman', 'VS Code', 'IntelliJ', 'Figma', 'Tableau']
};

const SEMANTIC_CLUSTERS = {
    'Cloud Architecture': ['AWS', 'scalability', 'microservices', 'Kubernetes', 'distributed', 'serverless'],
    'Full Stack': ['frontend', 'backend', 'API', 'database', 'React', 'Node.js'],
    'Data Science': ['Python', 'machine learning', 'data analysis', 'visualization', 'statistics'],
    'DevOps': ['CI/CD', 'automation', 'deployment', 'monitoring', 'infrastructure'],
    'Mobile Development': ['iOS', 'Android', 'React Native', 'Flutter', 'mobile app'],
    'Project Management': ['Agile', 'Scrum', 'team', 'leadership', 'stakeholder']
};

function detectParsingIssues(text) {
    const issues = [];
    const lines = text.split('\n');
    const avgLineLength = lines.length ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 0;
    
    if (avgLineLength > 0 && avgLineLength < 40) {
        issues.push({
            type: 'critical',
            message: 'Multi-column layout detected - ATS reads left-to-right, scrambling content',
            penalty: 25,
            fix: 'Use single-column format'
        });
    }

    if (text.includes('|') || text.match(/\t{2,}/)) {
        issues.push({
            type: 'critical',
            message: 'Table formatting detected - parsers read row-by-row, destroying structure',
            penalty: 20,
            fix: 'Convert tables to standard bullet points'
        });
    }

    if (text.match(/[█▓▒░●○◆◇■□]/)) {
        issues.push({
            type: 'critical',
            message: 'Graphic elements/skill bars detected - invisible to text parsers',
            penalty: 15,
            fix: 'Replace visual elements with text descriptions'
        });
    }

    const textLower = text.toLowerCase();
    if (textLower.includes('my journey') || textLower.includes('about me')) {
        issues.push({
            type: 'warning',
            message: 'Non-standard section headers detected',
            penalty: 10,
            fix: 'Use standard headers: Experience, Education, Skills, etc.'
        });
    }

    const dateFormats = [];
    if (text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i)) dateFormats.push('MMM YYYY');
    if (text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) dateFormats.push('MM/DD/YYYY');
    if (text.match(/\d{4}-\d{2}-\d{2}/)) dateFormats.push('YYYY-MM-DD');

    if (dateFormats.length > 1) {
        issues.push({
            type: 'warning',
            message: 'Inconsistent date formats detected',
            penalty: 8,
            fix: 'Use consistent format throughout (e.g., "Jan 2023")'
        });
    }

    return issues;
}

function detectSkills(text) {
    const found = [];
    Object.values(SKILLS_DATABASE).flat().forEach(skill => {
        const regex = new RegExp('\\b' + skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (regex.test(text.toLowerCase())) {
            found.push(skill);
        }
    });
    return [...new Set(found)];
}

function detectCertifications(text) {
    const certs = [];
    const certPatterns = ['AWS Certified', 'Google Cloud', 'Microsoft Certified', 'PMP', 'Scrum Master', 
                        'CISSP', 'CompTIA', 'Salesforce', 'Oracle Certified'];

    certPatterns.forEach(cert => {
        if (text.toLowerCase().includes(cert.toLowerCase())) {
            certs.push(cert);
        }
    });
    return certs;
}

function validateSemanticClusters(text) {
    const matches = [];
    const textLower = text.toLowerCase();

    Object.entries(SEMANTIC_CLUSTERS).forEach(([cluster, keywords]) => {
        let matchCount = 0;
        keywords.forEach(keyword => {
            if (textLower.includes(keyword.toLowerCase())) {
                matchCount++;
            }
        });

        if (matchCount >= 3) {
            matches.push({
                cluster,
                strength: Math.round((matchCount / keywords.length) * 100)
            });
        }
    });

    return matches;
}

function detectRedFlags(text, originalText) {
    const flags = [];
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = {};
    
    words.forEach(word => {
        if (word.length > 3) {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
    });

    Object.entries(wordFreq).forEach(([word, count]) => {
        if (count > 10) {
            flags.push({
                type: 'critical',
                message: `Keyword stuffing detected: "${word}" appears ${count} times`,
                penalty: 15
            });
        }
    });

    const trigrams = {};
    for (let i = 0; i < words.length - 2; i++) {
        const trigram = words.slice(i, i + 3).join(' ');
        if (trigram.length > 10) {
            trigrams[trigram] = (trigrams[trigram] || 0) + 1;
        }
    }

    Object.entries(trigrams).forEach(([phrase, count]) => {
        if (count > 3) {
            flags.push({
                type: 'warning',
                message: `Phrase repetition: "${phrase}" appears ${count} times`,
                penalty: 10
            });
        }
    });

    if (originalText.match(/color:\s*#?fff/i) || originalText.match(/color:\s*white/i)) {
        flags.push({
            type: 'critical',
            message: 'Potential hidden text detected (white text on white background)',
            penalty: 40
        });
    }

    return flags;
}

function detectContactInfo(text) {
    return {
        email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text),
        phone: /\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}/.test(text),
        linkedin: /linkedin\.com/.test(text),
        github: /github\.com/.test(text),
        portfolio: /(portfolio|website|blog)/.test(text)
    };
}

function detectExperienceYears(text) {
    const matches = text.match(/\d+\+?\s*(years?|yrs?)\s*(of)?\s*experience/gi);
    if (matches && matches.length > 0) {
        const nums = matches[0].match(/\d+/);
        return nums ? parseInt(nums[0]) : 0;
    }

    const dateRanges = text.match(/\d{4}\s*[-–]\s*(\d{4}|present|current)/gi);
    if (dateRanges && dateRanges.length > 0) {
        let totalYears = 0;
        dateRanges.forEach(range => {
            const years = range.match(/\d{4}/g);
            if (years && years.length >= 1) {
                const start = parseInt(years[0]);
                const end = years[1] ? parseInt(years[1]) : new Date().getFullYear();
                totalYears += (end - start);
            }
        });
        return Math.min(totalYears, 20);
    }

    return 0;
}

function detectEducation(text) {
    const degrees = [];
    if (/ph\.?d|doctorate/i.test(text)) degrees.push('phd');
    if (/master|m\.?s\.?|m\.?b\.?a/i.test(text)) degrees.push('master');
    if (/bachelor|b\.?s\.?|b\.?a\.?|b\.?tech/i.test(text)) degrees.push('bachelor');
    if (/associate|a\.?s\.?/i.test(text)) degrees.push('associate');
    return degrees;
}

function analyzeStructure(text) {
    const textLower = text.toLowerCase();
    return {
        hasExperience: /experience|work history|employment/i.test(textLower),
        hasEducation: /education|academic|degree/i.test(textLower),
        hasSkills: /skills|technical|competencies/i.test(textLower),
        hasSummary: /summary|profile|about/i.test(textLower),
        hasObjective: /objective|goal/i.test(textLower),
        hasReferences: /references|recommendations/i.test(textLower),
        hasCertifications: /certifications|certificates/i.test(textLower),
        hasProjects: /projects|portfolio/i.test(textLower)
    };
}

function analyzeBulletPoints(text) {
    const bullets = text.match(/[•●◆■□-]\s+.+/g) || [];
    const wordCounts = bullets.map(bullet => bullet.split(/\s+/).length);

    const avg = wordCounts.reduce((sum, count) => sum + count, 0) / (wordCounts.length || 1);
    const inRange = wordCounts.filter(count => count >= 12 && count <= 28).length;
    const hasMetrics = bullets.filter(bullet => 
        /\d+%|\$\d+|\d+x|\d+ (users|customers|clients|projects)/i.test(bullet)
    ).length;

    return {
        total: bullets.length,
        avgWords: Math.round(avg),
        inOptimalRange: inRange,
        withMetrics: hasMetrics
    };
}

function performAnalysis(resumeText) {
    const text = resumeText.toLowerCase();

    // Stage 1: Parsing Simulation
    const parsingIssues = detectParsingIssues(resumeText);
    let parsingPenalty = 0;
    parsingIssues.forEach(issue => parsingPenalty += issue.penalty);

    // Stage 2: Keyword Matching (45%)
    const detectedSkills = detectSkills(text);
    const skillCount = detectedSkills.length;
    let keywordScore = 0;

    if (skillCount >= 20 && skillCount <= 35) {
        keywordScore = 45;
    } else if (skillCount > 35) {
        keywordScore = 45 - ((skillCount - 35) * 0.5);
    } else {
        keywordScore = (skillCount / 20) * 45;
    }

    const certifications = detectCertifications(text);
    keywordScore += certifications.length * 2;
    keywordScore = Math.min(keywordScore, 45);

    // Stage 3: Semantic Matching (20%)
    const semanticMatches = validateSemanticClusters(text);
    const semanticScore = (semanticMatches.length / Object.keys(SEMANTIC_CLUSTERS).length) * 20;

    // Stage 4: Red Flag Detection
    const redFlags = detectRedFlags(text, resumeText);
    let redFlagPenalty = 0;
    redFlags.forEach(flag => redFlagPenalty += flag.penalty);

    // Stage 5: Contact Information (5%)
    const contactInfo = detectContactInfo(text);
    let contactScore = 0;
    if (contactInfo.email) contactScore += 1.75;
    if (contactInfo.phone) contactScore += 1.25;
    if (contactInfo.linkedin) contactScore += 1;
    if (contactInfo.github) contactScore += 0.5;
    if (contactInfo.portfolio) contactScore += 0.5;

    // Stage 6: Experience Level (12%)
    const experienceYears = detectExperienceYears(text);
    const experienceScore = Math.min((experienceYears / 5) * 12, 12);

    // Stage 7: Education (8%)
    const education = detectEducation(text);
    let educationScore = 0;
    if (education.includes('phd')) educationScore = 8;
    else if (education.includes('master')) educationScore = 7;
    else if (education.includes('bachelor')) educationScore = 6;
    else if (education.includes('associate')) educationScore = 4;

    // Stage 8: Structure (10%)
    const structure = analyzeStructure(resumeText);
    let structureScore = 10;
    if (structure.hasObjective && structure.hasSummary) structureScore -= 2;
    if (structure.hasReferences) structureScore -= 2;
    if (!structure.hasExperience) structureScore -= 3;
    if (!structure.hasSkills) structureScore -= 2;

    // Stage 9-12: Additional factors
    const bulletQuality = analyzeBulletPoints(resumeText);
    const wordCount = resumeText.split(/\s+/).length;
    let lengthScore = 0;
    if (wordCount >= 400 && wordCount <= 700) lengthScore = 3;
    else lengthScore = Math.max(0, 3 - Math.abs(550 - wordCount) / 100);

    // Calculate parse rate
    const parseRate = Math.max(0, 100 - parsingPenalty);

    // Total Score
    let totalScore = keywordScore + semanticScore + experienceScore + 
                   educationScore + contactScore + structureScore + lengthScore;
    totalScore = Math.max(0, totalScore - redFlagPenalty);
    totalScore = Math.min(100, totalScore);

    return {
        totalScore,
        parseRate,
        keywordScore,
        semanticScore,
        experienceScore,
        educationScore,
        contactScore,
        structureScore,
        parsingIssues,
        detectedSkills,
        contactInfo,
        structure,
        semanticMatches,
        redFlags,
        certifications,
        bulletQuality
    };
}

module.exports = {
    performAnalysis
};
