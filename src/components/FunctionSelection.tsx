
import { useApp } from '@/context/AppContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Function } from 'lucide-react';

export default function FunctionSelection() {
  const { systemFunctions, selectedFunctionId, setSelectedFunctionId } = useApp();

  const handleFunctionChange = (value: string) => {
    setSelectedFunctionId(value);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Function size={20} /> System Function Selection
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

            {selectedFunctionId && (
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Related Sequence Diagrams:</h4>
                <ul className="list-disc pl-5">
                  {systemFunctions
                    .find((f) => f.id === selectedFunctionId)
                    ?.sequenceDiagramNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                </ul>
              </div>
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
