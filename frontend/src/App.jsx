import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [backendMessage, setBackendMessage] = useState('');
  
  useEffect(() => {
    // This function fetches data from the backend
    const fetchData = async () => {
      try {
        // Use the backend service name when accessing from within Docker
        const apiUrl = import.meta.env.PROD 
        ? 'http://backend:3000/api/hello'  // Docker network
        : 'http://localhost:3000/api/hello'; // Local development
          
        const response = await fetch(apiUrl);
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
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-8">
          Welcome to VMS
        </h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">
            Vendor Management Software for Construction & Real Estate
          </h2>
          <p className="text-gray-700 mb-4">
            This platform will help you manage vendors, track projects, and streamline your business operations.
          </p>
          <div className="mt-8 p-4 bg-gray-100 rounded-md">
            <p className="text-sm font-medium">Backend Connection Status:</p>
            <p className="text-green-600 font-bold">{backendMessage || 'Connecting...'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
