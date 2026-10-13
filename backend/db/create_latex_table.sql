-- 创建LaTeX题目表
CREATE TABLE IF NOT EXISTS latex_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  latex_path VARCHAR(255) NOT NULL,
  subject VARCHAR(50) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  year VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  folder_name VARCHAR(50) NOT NULL,
  correct_answer VARCHAR(50) NOT NULL,
  note TEXT,
  latex_code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 添加索引以提高查询性能
CREATE INDEX idx_latex_path ON latex_questions(latex_path);
CREATE INDEX idx_subject ON latex_questions(subject);
CREATE INDEX idx_grade ON latex_questions(grade);
CREATE INDEX idx_year ON latex_questions(year);
CREATE INDEX idx_type ON latex_questions(type);