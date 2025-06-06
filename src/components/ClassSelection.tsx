
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Code } from 'lucide-react';

export default function ClassSelection() {
  const { 
    filteredClasses, 
    selectedClassIds, 
    toggleClassSelection, 
    generateCode,
    selectedFunctionId,
    isGenerating
  } = useApp();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Code size={20} /> Class Selection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!selectedFunctionId ? (
          <div className="text-center py-10 text-gray-500">
            Please select a system function first.
          </div>
        ) : filteredClasses.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Select classes to generate stubs and drivers for:
            </p>
            
            <div className="border rounded-md">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center space-x-2 p-3 border-b last:border-0 hover:bg-gray-50"
                >
                  <Checkbox
                    id={`class-${cls.id}`}
                    checked={selectedClassIds.includes(cls.id)}
                    onCheckedChange={() => toggleClassSelection(cls.id)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={`class-${cls.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {cls.name}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {cls.packageName}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button 
              className="w-full" 
              onClick={generateCode}
              disabled={selectedClassIds.length === 0 || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Stubs & Drivers'}
            </Button>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No classes related to the selected function.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
