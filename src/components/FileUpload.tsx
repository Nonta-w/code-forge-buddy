import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { FileType } from '@/types';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { validateFileExtension } from '@/utils/fileUtils';
import { Upload, FileText, ActivitySquare, ArrowRight, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import RefProcessingStatus from './RefProcessingStatus';

export default function FileUpload() {
  const { addFile, isLoading, setCurrentStep, uploadedFiles, sequenceDiagrams } = useApp();
  const [activeTab, setActiveTab] = useState<FileType>('rtm');
  const [lastProcessedReferences, setLastProcessedReferences] = useState<Array<{
    id: string;
    name: string;
    diagramName?: string;
    found: boolean;
  }>>([]);
  const [generatedStubs, setGeneratedStubs] = useState<string[]>([]);
  
  // Check if RTM file has been uploaded
  const hasRtmFile = uploadedFiles.some(file => file.type === 'rtm');
  
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        if (acceptedFiles.length === 0) {
          toast.error('No files uploaded');
          return;
        }
        
        const file = acceptedFiles[0];
        
        // Validate file type
        if (!validateFileExtension(file, activeTab)) {
          toast.error(
            `Invalid file type. Please upload a ${
              activeTab === 'rtm' ? 'CSV' : 'XML'
            } file.`
          );
          return;
        }
        
        // Process file
        const result = await addFile(file, activeTab);
        
        // If this is a sequence diagram, check for REF boxes and show status
        if (activeTab === 'sequenceDiagram' && result) {
          const diagram = sequenceDiagrams.find(d => d.name === file.name.replace('.xml', ''));
          if (diagram && diagram.references.length > 0) {
            console.log('Processing REF boxes for diagram:', diagram.name);
            
            // Check which referenced diagrams exist
            const referencesWithStatus = diagram.references.map(ref => {
              const found = sequenceDiagrams.some(d => {
                // Enhanced matching logic
                if (!ref.diagramName) return false;
                
                // Try exact match
                if (d.name === ref.diagramName) return true;
                
                // Try case-insensitive match
                if (d.name.toLowerCase() === ref.diagramName.toLowerCase()) return true;
                
                // Try partial match
                if (d.name.toLowerCase().includes(ref.diagramName.toLowerCase()) ||
                    ref.diagramName.toLowerCase().includes(d.name.toLowerCase())) return true;
                
                return false;
              });
              
              return {
                id: ref.id,
                name: ref.name,
                diagramName: ref.diagramName,
                found
              };
            });
            
            setLastProcessedReferences(referencesWithStatus);
            
            // Simulate additional stubs that would be generated
            const foundRefs = referencesWithStatus.filter(ref => ref.found);
            const stubNames = foundRefs.map(ref => `${ref.diagramName}Stub.java`);
            setGeneratedStubs(stubNames);
            
            // Show summary toast
            const foundCount = foundRefs.length;
            const totalCount = referencesWithStatus.length;
            
            if (foundCount === totalCount && totalCount > 0) {
              toast.success(`All ${totalCount} referenced diagrams found! Additional stubs will be generated.`);
            } else if (foundCount > 0) {
              toast.warning(`${foundCount}/${totalCount} referenced diagrams found. Upload missing diagrams for complete processing.`);
            } else if (totalCount > 0) {
              toast.warning(`${totalCount} referenced diagrams missing. Upload them for complete processing.`);
            }
          } else {
            // Clear status if no references
            setLastProcessedReferences([]);
            setGeneratedStubs([]);
          }
        }
      } catch (error) {
        console.error('Error in onDrop:', error);
        toast.error('Error uploading file');
      }
    },
    [activeTab, addFile, sequenceDiagrams]
  );
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isLoading,
    accept: {
      'text/csv': activeTab === 'rtm' ? ['.csv'] : [],
      'application/xml': activeTab !== 'rtm' ? ['.xml'] : []
    },
    multiple: false
  });
  
  const handleNextStep = () => {
    if (hasRtmFile) {
      setCurrentStep(2); // Go to function selection
    }
  };
  
  return (
    <div className="w-full px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Upload Files</h2>
        <p className="text-gray-600">
          Upload your RTM, Sequence Diagrams, and Class Diagrams to get started.
        </p>
      </div>
      
      <Tabs defaultValue="rtm" onValueChange={(value) => setActiveTab(value as FileType)}>
        <TabsList className="mb-4 grid grid-cols-3 w-full">
          <TabsTrigger value="rtm" className="flex items-center gap-2">
            <FileText size={16} />
            <span>RTM</span>
          </TabsTrigger>
          <TabsTrigger value="sequenceDiagram" className="flex items-center gap-2">
            <ActivitySquare size={16} />
            <span>Sequence Diagram</span>
          </TabsTrigger>
          <TabsTrigger value="classDiagram" className="flex items-center gap-2">
            <ActivitySquare size={16} />
            <span>Class Diagram</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="rtm" className="mt-0">
          <div
            {...getRootProps()}
            className={`file-drop-area ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive
                ? 'Drop the RTM CSV file here'
                : 'Drag & drop RTM CSV file here'}
            </p>
            <div className="text-sm text-gray-500 mb-4">
              <p>CSV file should contain these columns:</p>
              <div className="flex items-center gap-2 mt-2 justify-center">
                <p className="bg-gray-100 px-2 py-1 rounded">Requirement ID</p>
                <p className="bg-gray-100 px-2 py-1 rounded">System Function</p>
                <p className="bg-gray-100 px-2 py-1 rounded">Sequence Diagram</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-blue-500">
                      <HelpCircle size={16} />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm">
                      <p>The CSV file should have a header row with these column names (or similar):</p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Requirement ID (or "Req ID", "ID", etc.)</li>
                        <li>System Function (or "Function Name", "Description", etc.)</li>
                        <li>Sequence Diagram (or "Diagram", "Sequence", etc.)</li>
                        <li>Optional: Related Sequence Diagram</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <Button disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Select File'}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="sequenceDiagram" className="mt-0">
          <div
            {...getRootProps()}
            className={`file-drop-area ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive
                ? 'Drop the Sequence Diagram XML file here'
                : 'Drag & drop Sequence Diagram XML file here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              XML file exported from Visual Paradigm
            </p>
            <Button disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Select File'}
            </Button>
          </div>
          
          {/* Show REF processing status for sequence diagrams */}
          <RefProcessingStatus 
            references={lastProcessedReferences}
            generatedStubs={generatedStubs}
          />
        </TabsContent>
        
        <TabsContent value="classDiagram" className="mt-0">
          <div
            {...getRootProps()}
            className={`file-drop-area ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">
              {isDragActive
                ? 'Drop the Class Diagram XML file here'
                : 'Drag & drop Class Diagram XML file here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              XML file exported from Visual Paradigm
            </p>
            <Button disabled={isLoading}>
              {isLoading ? 'Uploading...' : 'Select File'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      
      {hasRtmFile && (
        <div className="mt-6 flex justify-center">
          <Button 
            onClick={handleNextStep} 
            className="flex items-center gap-2"
          >
            Continue to Function Selection
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
