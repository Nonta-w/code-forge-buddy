
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCode, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CodeViewer() {
  const { generatedCodes } = useApp();
  const [activeCodeId, setActiveCodeId] = useState<string | null>(
    generatedCodes.length > 0 ? generatedCodes[0].id : null
  );

  const activeCode = generatedCodes.find((code) => code.id === activeCodeId);

  const downloadCode = () => {
    if (!activeCode) return;

    const element = document.createElement('a');
    const file = new Blob([activeCode.fileContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = activeCode.fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success(`Downloaded ${activeCode.fileName}`);
  };

  const downloadAllCode = () => {
    // In a real application, this would use JSZip to create a zip file
    // For this demo, we'll download each file individually
    generatedCodes.forEach((code) => {
      const element = document.createElement('a');
      const file = new Blob([code.fileContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = code.fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });

    toast.success(`Downloaded ${generatedCodes.length} files`);
  };

  if (generatedCodes.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <FileCode size={20} /> Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 text-gray-500">
            No code has been generated yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={20} /> Generated Code
          </div>
          <Button
            size="sm"
            onClick={downloadAllCode}
            className="flex items-center gap-1"
          >
            <Download size={16} />
            <span>Download All</span>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs
          value={activeCodeId || ''}
          onValueChange={setActiveCodeId}
          className="w-full h-full flex flex-col"
        >
          <div className="flex justify-between items-center p-4 border-b">
            <ScrollArea className="flex-1 max-w-[calc(100%-120px)]">
              <TabsList className="w-max flex-nowrap">
                {generatedCodes.map((code) => (
                  <TabsTrigger key={code.id} value={code.id} className="whitespace-nowrap">
                    {code.fileName}
                    <span className="ml-2 bg-gray-200 px-1.5 py-0.5 rounded text-xs">
                      {code.type}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
            {activeCode && (
              <Button
                size="sm"
                variant="outline"
                onClick={downloadCode}
                className="flex items-center gap-1 ml-4"
              >
                <Download size={16} />
                <span>Download</span>
              </Button>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {generatedCodes.map((code) => (
              <TabsContent key={code.id} value={code.id} className="m-0 h-full">
                <div className="flex flex-col h-full">
                  <div className="bg-slate-800 text-white p-2 text-xs border-b">
                    {code.fileName} • {new Date(code.timestamp).toLocaleString()}
                  </div>
                  <ScrollArea className="flex-1">
                    <pre className="code-editor p-4 text-sm">{code.fileContent}</pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
