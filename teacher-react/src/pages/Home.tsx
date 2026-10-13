import React from 'react';
import { Typography, Card, Row, Col, Statistic } from 'antd';
import { FileTextOutlined, UserOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <Typography>
        <Title level={2}>欢迎使用教师管理系统</Title>
        <Paragraph>
          本系统提供试卷管理、批改和统计分析等功能，帮助教师高效管理教学工作。
        </Paragraph>
      </Typography>

      <Row gutter={16} style={{ marginTop: '20px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="试卷总数"
              value={42}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="学生人数"
              value={120}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已批改"
              value={36}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: '20px' }}>
        <Title level={3}>系统功能</Title>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card title="试卷管理" variant="borderless">
              上传和管理各类试卷，支持多种格式导入。
            </Card>
          </Col>
          <Col span={8}>
            <Card title="批改系统" variant="borderless">
              高效批改学生答卷，自动统计分数。
            </Card>
          </Col>
          <Col span={8}>
            <Card title="数据分析" variant="borderless">
              分析学生成绩，生成统计报表。
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Home;