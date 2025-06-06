
import { useApp } from '@/context/AppContext';
import AppHeader from '@/components/AppHeader';
import FileUpload from '@/components/FileUpload';
import FileManager from '@/components/FileManager';
import FunctionSelection from '@/components/FunctionSelection';
import ClassSelection from '@/components/ClassSelection';
import CodeViewer from '@/components/CodeViewer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const Index = () => {
  const { currentStep, uploadedFiles } = useApp();
  
  // Determine if requirements for each step are met
  const hasRtmFile = uploadedFiles.some(file => file.type === 'rtm');

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <FileUpload />
            <div className="px-4 py-6">
              <FileManager />
            </div>
          </>
        );
      case 2:
        // Show function selection if RTM file is uploaded, otherwise show error
        return hasRtmFile ? (
          <div className="px-4 py-6">
            <FunctionSelection />
          </div>
        ) : (
          <div className="px-4 py-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please upload an RTM file first. Return to Step 1 to upload files.
              </AlertDescription>
            </Alert>
          </div>
        );
      case 3:
        return (
          <div className="px-4 py-6">
            <ClassSelection />
          </div>
        );
      case 4:
        return (
          <div className="px-4 py-6 h-full">
            <CodeViewer />
          </div>
        );
      default:
        return <FileUpload />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <div className="flex-1 container mx-auto py-4 flex flex-col min-h-0">
        <div className={`bg-white shadow-sm rounded-lg overflow-hidden ${currentStep === 4 ? 'flex-1 flex flex-col min-h-0' : ''}`}>
          {renderStep()}
        </div>
      </div>
      <footer className="py-4 text-center text-sm text-gray-500">
        Stub & Driver Generator Tool for System Testing © 2025
      </footer>
    </div>
  );
};

export default Index;
