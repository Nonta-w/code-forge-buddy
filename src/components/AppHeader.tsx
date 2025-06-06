
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';

export default function AppHeader() {
  const { currentStep, setCurrentStep } = useApp();

  const steps = [
    { id: 1, name: 'Upload Files' },
    { id: 2, name: 'Select Function' },
    { id: 3, name: 'Select Classes' },
    { id: 4, name: 'Generated Code' }
  ];

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
                      onClick={() => setCurrentStep(step.id)}
                      className="relative"
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
