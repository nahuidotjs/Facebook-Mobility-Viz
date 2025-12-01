import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { MovementRecord } from './types';
import { parseMovementData } from './services/dataService';

const App: React.FC = () => {
  const [data, setData] = useState<MovementRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDataLoaded = useCallback((content: string) => {
    setIsLoading(true);
    // Use setTimeout to allow the UI to show the loading spinner before the heavy parsing starts
    setTimeout(() => {
      try {
        const parsedData = parseMovementData(content);
        setData(parsedData);
      } catch (error) {
        console.error("Failed to parse data", error);
        alert("Failed to parse the file. Please ensure it is the correct format.");
      } finally {
        setIsLoading(false);
      }
    }, 100);
  }, []);

  const handleReset = () => {
    setData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {!data ? (
        <FileUpload onDataLoaded={handleDataLoaded} isLoading={isLoading} />
      ) : (
        <Dashboard data={data} onReset={handleReset} />
      )}
    </div>
  );
};

export default App;
