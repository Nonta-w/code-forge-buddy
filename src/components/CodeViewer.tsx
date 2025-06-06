
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCode, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CodeViewer() {
  const { codeSessions } = useApp();
  const [openSessions, setOpenSessions] = useState<Set<string>>(
    new Set(codeSessions.map(session => session.id))
  );
  const [activeCodeId, setActiveCodeId] = useState<string | null>(null);

  const toggleSession = (sessionId: string) => {
    setOpenSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const downloadCode = (code: any) => {
    const element = document.createElement('a');
    const file = new Blob([code.fileContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = code.fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast.success(`Downloaded ${code.fileName}`);
  };

  const downloadSessionCodes = (session: any) => {
    session.codes.forEach((code: any) => {
      const element = document.createElement('a');
      const file = new Blob([code.fileContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = code.fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });

    toast.success(`Downloaded ${session.codes.length} files from ${session.name}`);
  };

  const downloadAllCode = () => {
    const allCodes = codeSessions.flatMap(session => session.codes);
    allCodes.forEach((code) => {
      const element = document.createElement('a');
      const file = new Blob([code.fileContent], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = code.fileName;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });

    toast.success(`Downloaded ${allCodes.length} files`);
  };

  if (codeSessions.length === 0) {
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
            <FileCode size={20} /> Generated Code Sessions
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
        <div className="space-y-2 p-4">
          {codeSessions.slice().reverse().map((session) => (
            <Collapsible
              key={session.id}
              open={openSessions.has(session.id)}
              onOpenChange={() => toggleSession(session.id)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      {openSessions.has(session.id) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronUp size={16} />
                      )}
                      <div>
                        <h3 className="font-medium">{session.name}</h3>
                        <p className="text-sm text-gray-500">
                          {session.codes.length} files • {new Date(session.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSessionCodes(session);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </Button>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="border-t">
                    <Tabs
                      value={activeCodeId || ''}
                      onValueChange={setActiveCodeId}
                      className="w-full"
                    >
                      <div className="flex justify-between items-start p-4 border-b gap-4">
                        <div className="flex-1 min-w-0">
                          <TabsList className="w-full h-auto flex-wrap gap-1 justify-start bg-transparent p-0">
                            {session.codes.map((code) => (
                              <TabsTrigger 
                                key={code.id} 
                                value={code.id} 
                                className="whitespace-nowrap flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                              >
                                {code.fileName}
                                <span className="ml-2 bg-gray-200 px-1.5 py-0.5 rounded text-xs">
                                  {code.type}
                                </span>
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </div>
                      </div>

                      <div className="max-h-96">
                        {session.codes.map((code) => (
                          <TabsContent key={code.id} value={code.id} className="m-0">
                            <div className="flex flex-col">
                              <div className="bg-slate-800 text-white p-2 text-xs border-b flex justify-between items-center">
                                <span>{code.fileName} • {new Date(code.timestamp).toLocaleString()}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => downloadCode(code)}
                                  className="text-white hover:bg-slate-700 h-6 px-2"
                                >
                                  <Download size={12} />
                                </Button>
                              </div>
                              <ScrollArea className="h-80">
                                <pre className="code-editor p-4 text-sm">{code.fileContent}</pre>
                              </ScrollArea>
                            </div>
                          </TabsContent>
                        ))}
                      </div>
                    </Tabs>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
