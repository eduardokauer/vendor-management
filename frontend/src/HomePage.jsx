// frontend/src/HomePage.jsx
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [backendMessage, setBackendMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(import.meta.env.VITE_API_URL + '/api/hello');
        const data = await response.json();
        setBackendMessage(data.message);
      } catch (error) {
        console.error('Error fetching data:', error);
        setBackendMessage('Could not connect to backend');
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Your existing home page content */}
    </div>
  );
}