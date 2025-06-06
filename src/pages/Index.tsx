
import { useApp } from '@/context/AppContext';
import AppHeader from '@/components/AppHeader';
import FileUpload from '@/components/FileUpload';
import FileManager from '@/components/FileManager';
import FunctionSelection from '@/components/FunctionSelection';
import ClassSelection from '@/components/ClassSelection';
import CodeViewer from '@/components/CodeViewer';

const Index = () => {
  const { currentStep } = useApp();

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
        return (
          <div className="px-4 py-6">
            <FunctionSelection />
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
          <div className="px-4 py-6">
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
      <div className="flex-1 container mx-auto py-4">
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
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
