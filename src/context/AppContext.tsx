
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  UploadedFile,
  SystemFunction,
  ClassInfo,
  SequenceDiagram,
  GeneratedCode,
  FileType
} from '@/types';
import {
  processRTMFile,
  processSequenceDiagramFile,
  processClassDiagramFile,
  mapFunctionsToClasses,
  generateStubCode,
  generateDriverCode,
  generateId
} from '@/utils/fileUtils';

interface AppContextType {
  // Files
  uploadedFiles: UploadedFile[];
  addFile: (file: File, type: FileType) => Promise<void>;
  removeFile: (id: string) => void;
  
  // RTM and Functions
  systemFunctions: SystemFunction[];
  selectedFunctionId: string | null;
  setSelectedFunctionId: (id: string | null) => void;
  
  // Classes
  allClasses: ClassInfo[];
  filteredClasses: ClassInfo[];
  selectedClassIds: string[];
  toggleClassSelection: (id: string) => void;
  
  // Sequence Diagrams
  sequenceDiagrams: SequenceDiagram[];
  
  // Code Generation
  generatedCodes: GeneratedCode[];
  generateCode: () => void;
  
  // UI State
  currentStep: number;
  setCurrentStep: (step: number) => void;
  
  // Status flags
  isLoading: boolean;
  isGenerating: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Files state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // RTM state
  const [systemFunctions, setSystemFunctions] = useState<SystemFunction[]>([]);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  
  // Classes state
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassInfo[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  
  // Sequence Diagrams state
  const [sequenceDiagrams, setSequenceDiagrams] = useState<SequenceDiagram[]>([]);
  
  // Generated Code state
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
  
  // UI state
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Add file
  const addFile = async (file: File, type: FileType) => {
    try {
      setIsLoading(true);
      
      // Read file content
      const reader = new FileReader();
      const content = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      
      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        id: generateId(),
        name: file.name,
        type,
        size: file.size,
        lastModified: file.lastModified,
        content,
        timestamp: new Date()
      };
      
      // Process file based on type
      if (type === 'rtm') {
        const functions = await processRTMFile(file);
        setSystemFunctions(functions);
      } else if (type === 'sequenceDiagram') {
        const diagram = await processSequenceDiagramFile(file);
        if (diagram) {
          setSequenceDiagrams(prev => [...prev, diagram]);
        }
      } else if (type === 'classDiagram') {
        const classes = await processClassDiagramFile(file);
        if (classes) {
          setAllClasses(classes);
        }
      }
      
      // Update uploaded files
      setUploadedFiles(prev => [...prev, uploadedFile]);
      toast.success(`File ${file.name} uploaded successfully`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Remove file
  const removeFile = (id: string) => {
    const fileToRemove = uploadedFiles.find(f => f.id === id);
    if (!fileToRemove) return;
    
    // Remove file and related data
    if (fileToRemove.type === 'rtm') {
      setSystemFunctions([]);
      setSelectedFunctionId(null);
    } else if (fileToRemove.type === 'sequenceDiagram') {
      setSequenceDiagrams(prev => prev.filter(d => d.name !== fileToRemove.name));
    } else if (fileToRemove.type === 'classDiagram') {
      setAllClasses([]);
      setFilteredClasses([]);
    }
    
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    toast.success(`File ${fileToRemove.name} removed`);
  };
  
  // Toggle class selection
  const toggleClassSelection = (id: string) => {
    setSelectedClassIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(classId => classId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Generate code
  const generateCode = () => {
    try {
      setIsGenerating(true);
      
      const selectedClasses = allClasses.filter(cls => selectedClassIds.includes(cls.id));
      const newGeneratedCodes: GeneratedCode[] = [];
      
      // Create a map of class names to class objects for quick lookup
      const classMap = new Map<string, ClassInfo>();
      allClasses.forEach(cls => {
        classMap.set(cls.name, cls);
      });
      
      // Find which classes need stubs and drivers
      const selectedClassNames = new Set(selectedClasses.map(cls => cls.name));
      const callGraph = new Map<string, Set<string>>();
      
      // Build call graph from sequence diagrams
      sequenceDiagrams.forEach(diagram => {
        diagram.messages.forEach(message => {
          const fromObj = diagram.objects.find(obj => obj.id === message.from);
          const toObj = diagram.objects.find(obj => obj.id === message.to);
          
          if (fromObj && toObj && fromObj.type && toObj.type) {
            if (!callGraph.has(fromObj.type)) {
              callGraph.set(fromObj.type, new Set<string>());
            }
            callGraph.get(fromObj.type)?.add(toObj.type);
          }
        });
      });
      
      // Generate stubs for classes that are called by selected classes but not in selection
      selectedClasses.forEach(selectedClass => {
        const calledClasses = callGraph.get(selectedClass.name) || new Set<string>();
        
        calledClasses.forEach(calledClassName => {
          if (!selectedClassNames.has(calledClassName)) {
            const calledClass = classMap.get(calledClassName);
            if (calledClass) {
              const stubCode = generateStubCode(calledClass);
              newGeneratedCodes.push({
                id: generateId(),
                fileName: `${calledClassName}Stub.java`,
                fileContent: stubCode,
                type: 'stub',
                timestamp: new Date(),
                relatedClass: calledClassName
              });
            }
          }
        });
      });
      
      // Generate drivers for classes that call selected classes but not in selection
      selectedClasses.forEach(selectedClass => {
        callGraph.forEach((calledClasses, callerClassName) => {
          if (calledClasses.has(selectedClass.name) && !selectedClassNames.has(callerClassName)) {
            // Generate driver for selected class
            const driverCode = generateDriverCode(selectedClass);
            newGeneratedCodes.push({
              id: generateId(),
              fileName: `${selectedClass.name}Driver.java`,
              fileContent: driverCode,
              type: 'driver',
              timestamp: new Date(),
              relatedClass: selectedClass.name
            });
          }
        });
      });
      
      // If no stubs or drivers were generated, create at least a driver for each selected class
      if (newGeneratedCodes.length === 0) {
        selectedClasses.forEach(selectedClass => {
          const driverCode = generateDriverCode(selectedClass);
          newGeneratedCodes.push({
            id: generateId(),
            fileName: `${selectedClass.name}Driver.java`,
            fileContent: driverCode,
            type: 'driver',
            timestamp: new Date(),
            relatedClass: selectedClass.name
          });
        });
      }
      
      setGeneratedCodes(prev => [...prev, ...newGeneratedCodes]);
      setCurrentStep(4); // Move to code view
      toast.success(`Generated ${newGeneratedCodes.length} code files`);
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Update filtered classes when selected function changes
  useEffect(() => {
    if (selectedFunctionId) {
      // Filter classes related to the selected function
      const filtered = allClasses.filter(
        cls => cls.relatedFunctions.includes(selectedFunctionId)
      );
      setFilteredClasses(filtered);
      // Clear selected class ids
      setSelectedClassIds([]);
    } else {
      setFilteredClasses([]);
    }
  }, [selectedFunctionId, allClasses]);
  
  // Update class relationships when RTM, classes, and sequence diagrams are all loaded
  useEffect(() => {
    if (
      systemFunctions.length > 0 &&
      allClasses.length > 0 &&
      sequenceDiagrams.length > 0
    ) {
      const updatedClasses = mapFunctionsToClasses(
        systemFunctions,
        sequenceDiagrams,
        allClasses
      );
      setAllClasses(updatedClasses);
    }
  }, [systemFunctions, sequenceDiagrams]);
  
  const value = {
    uploadedFiles,
    addFile,
    removeFile,
    systemFunctions,
    selectedFunctionId,
    setSelectedFunctionId,
    allClasses,
    filteredClasses,
    selectedClassIds,
    toggleClassSelection,
    sequenceDiagrams,
    generatedCodes,
    generateCode,
    currentStep,
    setCurrentStep,
    isLoading,
    isGenerating
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
