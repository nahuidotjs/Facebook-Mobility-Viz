import React, { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (content: string) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading }) => {
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt') && !file.name.endsWith('.tsv')) {
      setError('Please upload a valid .txt or .tsv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onDataLoaded(content);
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-20 p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Facebook Movement Data</h1>
        <p className="text-slate-500">Upload your tab-delimited (.txt) movement range file to generate the dashboard.</p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-200 ease-in-out text-center ${
          dragActive
            ? 'border-blue-500 bg-blue-50 scale-105'
            : 'border-slate-300 bg-white hover:border-blue-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept=".txt,.tsv"
          disabled={isLoading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          ) : (
            <>
              <div className="bg-blue-100 p-4 rounded-full">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Supported formats: .txt, .tsv (Max 500MB recommended)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      <div className="mt-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center mb-2">
          <FileText className="w-4 h-4 text-slate-500 mr-2" />
          <span className="text-sm font-semibold text-slate-700">Expected Format</span>
        </div>
        <p className="text-xs text-slate-500 font-mono overflow-x-auto whitespace-pre">
          ds | country | polygon_source | polygon_id ...
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
