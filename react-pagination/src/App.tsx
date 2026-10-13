// import { useState } from 'react'
import Auth from './Auth';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css'
import Login from './Login';
import Register from './Register';
import Profile from './Profile';
import Exams from './Exams';
import Upload from './Upload';
import Application from './Application';
import Records from './Records';
import Ocrpages from './Ocrpages';
import CommunityHome from './community/CommunityHome';
import PostDetail from './community/PostDetail';
import CreatePost from './community/CreatePost';
import NotificationsPage from './community/NotificationsPage';
import QuestionView from './QuestionView';

function App() {
  // const [count, setCount] = useState(0)

  return (
    <Router>
      <nav>
        <ul>
          <li>
            <Link to="/app">应用</Link>
          </li>
          <li>
            <Link to="/exams">真题</Link>
          </li>
          <li>
            <Link to="/square">广场</Link>
          </li>
          <li>
            <Link to="/profile">我的</Link>
          </li>
        </ul>
      </nav>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/app" element={<Auth><Application /></Auth>} />
        <Route path="/upload" element={<Auth><Upload /></Auth>} />
        <Route path="/records" element={<Auth><Records /></Auth>} />
        <Route path="/ocrpages" element={<Auth><Ocrpages /></Auth>} />
        <Route path="/question" element={<Auth><QuestionView /></Auth>} />

        <Route path="/exams" element={<Auth><Exams /></Auth>} />
        <Route path="/square" element={<Auth><CommunityHome /></Auth>} />
        <Route path="/post/:postId" element={<Auth><PostDetail /></Auth>} />
        <Route path="/create-post" element={<Auth><CreatePost /></Auth>} />
        <Route path="/notifications" element={<Auth><NotificationsPage /></Auth>} />
        <Route path="/profile" element={<Auth><Profile /></Auth>} />
      </Routes>
    </Router>
  )
}

export default App
