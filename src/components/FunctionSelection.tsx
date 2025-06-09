
import { useApp } from '@/context/AppContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeIcon, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FunctionSelection() {
  const { 
    systemFunctions, 
    selectedFunctionId, 
    setSelectedFunctionId, 
    setCurrentStep,
    sequenceDiagrams 
  } = useApp();

  const handleFunctionChange = (value: string) => {
    setSelectedFunctionId(value);
  };

  const handleProceedToClassSelection = () => {
    if (selectedFunctionId) {
      setCurrentStep(3);
    }
  };

  // Check for missing sequence diagrams
  const getMissingDiagrams = (functionId: string) => {
    const func = systemFunctions.find(f => f.id === functionId);
    if (!func) return [];
    
    const uploadedDiagramNames = new Set(sequenceDiagrams.map(d => d.name));
    const missingDiagrams = func.sequenceDiagramNames.filter(
      diagramName => !uploadedDiagramNames.has(diagramName)
    );
    
    return missingDiagrams;
  };

  const selectedFunction = systemFunctions.find(f => f.id === selectedFunctionId);
  const missingDiagrams = selectedFunctionId ? getMissingDiagrams(selectedFunctionId) : [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <CodeIcon size={20} /> System Function Selection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {systemFunctions.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-2">
              <p className="text-sm text-gray-500">
                Select a system function from RTM to display related classes
              </p>
              <Select
                value={selectedFunctionId || ''}
                onValueChange={handleFunctionChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a function" />
                </SelectTrigger>
                <SelectContent>
                  {systemFunctions.map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      {func.name} [{func.id}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFunction && (
              <>
                <div className="bg-blue-50 p-4 rounded-md">
                  <h4 className="font-medium mb-2">Related Sequence Diagrams:</h4>
                  <ul className="list-disc pl-5">
                    {selectedFunction.sequenceDiagramNames.map((name, index) => (
                      <li key={index} className={missingDiagrams.includes(name) ? 'text-red-600' : 'text-green-600'}>
                        {name} {missingDiagrams.includes(name) ? '(Missing)' : '(Uploaded)'}
                      </li>
                    ))}
                  </ul>
                </div>

                {missingDiagrams.length > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <strong>Missing Sequence Diagrams:</strong> Please upload the following sequence diagrams before proceeding:
                      <ul className="list-disc pl-5 mt-1">
                        {missingDiagrams.map((name, index) => (
                          <li key={index}>{name}</li>
                        ))}
                      </ul>
                      Go back to Step 1 to upload the missing diagrams.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  onClick={handleProceedToClassSelection}
                  className="w-full"
                  disabled={missingDiagrams.length > 0}
                >
                  {missingDiagrams.length > 0 
                    ? 'Upload Missing Diagrams First' 
                    : 'Proceed to Class Selection'
                  }
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            Please upload RTM file first.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
