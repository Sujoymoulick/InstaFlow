/**
 * Instaflow SEO Suite - Grade Scale Configuration & Helper
 */

export const GRADE_SCALE = [
  { grade: 'A+', min: 97, max: 100, label: 'Excellent', color: 'emerald' },
  { grade: 'A',  min: 93, max: 96,  label: 'Great', color: 'emerald' },
  { grade: 'A-', min: 90, max: 92,  label: 'Very Good', color: 'teal' },
  { grade: 'B+', min: 87, max: 89,  label: 'Good', color: 'blue' },
  { grade: 'B',  min: 83, max: 86,  label: 'Above Average', color: 'blue' },
  { grade: 'B-', min: 80, max: 82,  label: 'Satisfactory', color: 'cyan' },
  { grade: 'C+', min: 77, max: 79,  label: 'Fair', color: 'amber' },
  { grade: 'C',  min: 73, max: 76,  label: 'Moderate', color: 'amber' },
  { grade: 'C-', min: 70, max: 72,  label: 'Needs Attention', color: 'orange' },
  { grade: 'D+', min: 67, max: 69,  label: 'Poor', color: 'orange' },
  { grade: 'D',  min: 63, max: 66,  label: 'Very Poor', color: 'rose' },
  { grade: 'D-', min: 60, max: 62,  label: 'Critical Concern', color: 'rose' },
  { grade: 'F',  min: 0,  max: 59,  label: 'Failing', color: 'red' }
];

export function getGradeForScore(score) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  for (const item of GRADE_SCALE) {
    if (rounded >= item.min && rounded <= item.max) {
      return item.grade;
    }
  }
  return 'F';
}

export function getGradeInfo(gradeOrScore) {
  let grade = gradeOrScore;
  if (typeof gradeOrScore === 'number') {
    grade = getGradeForScore(gradeOrScore);
  }
  if (grade === 'N/A') {
    return { grade: 'N/A', label: 'Not Evaluated', color: 'slate', min: 0, max: 0 };
  }
  return GRADE_SCALE.find(g => g.grade === grade) || { grade, label: 'Unknown', color: 'slate' };
}
