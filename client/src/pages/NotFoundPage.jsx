import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/notfound.css';

const NotFoundPage = () => {
  return (
    <div className="notfound-page">
      <div className="notfound-content">
        <h1>404</h1>
        <p>Page Not Found</p>
        <p className="description">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
