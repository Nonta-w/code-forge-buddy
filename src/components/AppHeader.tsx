import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  CheckCircle, 
  Circle, 
  Settings,
  RotateCcw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function AppHeader() {
  const { currentStep, setCurrentStep, resetAll } = useApp();

  const steps = [
    { number: 1, title: 'Upload Files', icon: FileText },
    { number: 2, title: 'Select Function', icon: Settings },
    { number: 3, title: 'Select Classes', icon: CheckCircle },
    { number: 4, title: 'Generated Code', icon: FileText }
  ];

  const handleStepClick = (stepNumber) => {
    // Only allow clicking on current step or previous steps
    if (stepNumber <= currentStep) {
      setCurrentStep(stepNumber);
    }
  };

  const handleReset = () => {
    resetAll();
    setCurrentStep(1); // Reset to step 1
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Stub & Driver Generator
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Progress Steps */}
            <Card className="bg-gray-50">
              <CardContent className="py-3 px-4">
                <div className="flex items-center space-x-4">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.number;
                    const isCompleted = currentStep > step.number;
                    const isClickable = step.number <= currentStep;

                    return (
                      <div key={step.number} className="flex items-center">
                        <div 
                          className={`flex items-center space-x-2 ${
                            isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                          }`}
                          onClick={() => handleStepClick(step.number)}
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                            isCompleted 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : isActive 
                                ? 'bg-blue-500 border-blue-500 text-white' 
                                : isClickable
                                  ? 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                                  : 'bg-gray-100 border-gray-200 text-gray-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <span className="text-sm font-medium">{step.number}</span>
                            )}
                          </div>
                          <div className="hidden sm:block">
                            <Badge 
                              variant={isActive ? "default" : isCompleted ? "secondary" : isClickable ? "outline" : "secondary"}
                              className={`text-xs transition-colors ${
                                isClickable ? 'hover:bg-opacity-80' : 'opacity-60'
                              }`}
                            >
                              {step.title}
                            </Badge>
                          </div>
                        </div>
                        {index < steps.length - 1 && (
                          <div className={`hidden sm:block w-8 h-0.5 mx-2 transition-colors ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Reset Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <RotateCcw size={16} />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Data</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all uploaded files, generated code, and reset the application to step 1. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>
                    Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </header>
  );
}