
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

export default function AppHeader() {
  const { currentStep, setCurrentStep, uploadedFiles } = useApp();

  // Determine if we can navigate to each step based on prerequisites
  const canGoToFunctionSelection = uploadedFiles.some(file => file.type === 'rtm');
  
  const steps = [
    { id: 1, name: 'Upload Files', enabled: true },
    { id: 2, name: 'Select Function', enabled: canGoToFunctionSelection },
    { id: 3, name: 'Select Classes', enabled: false }, // Will enable when a function is selected
    { id: 4, name: 'Generated Code', enabled: false } // Will enable when code is generated
  ];

  const handleStepChange = (stepId: number) => {
    // Only allow navigation to enabled steps
    const step = steps.find(s => s.id === stepId);
    if (step && step.enabled) {
      setCurrentStep(stepId);
    }
  };

  return (
    <header className="bg-white border-b px-6 py-4">
      <div className="container mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Stub & Driver Generator
            </h1>
            <p className="text-sm text-gray-500">
              Generate stubs and drivers for system testing
            </p>
          </div>
          <div className="flex items-center">
            <nav className="flex items-center space-x-1">
              {steps.map((step) => (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={currentStep === step.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStepChange(step.id)}
                      className={`relative ${!step.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!step.enabled}
                    >
                      <span className="mr-1">{step.id}</span>
                      <span className="hidden sm:inline">{step.name}</span>
                      {currentStep === step.id && (
                        <span className="absolute -bottom-[5px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{step.name}</p>
                    {!step.enabled && step.id > 1 && (
                      <p className="text-xs text-red-500">
                        {step.id === 2 && "Upload RTM file first"}
                        {step.id === 3 && "Select a function first"}
                        {step.id === 4 && "Generate code first"}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
