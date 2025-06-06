
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { FileIcon, Trash2, ArrowRight } from 'lucide-react';

export default function FileManager() {
  const { uploadedFiles, removeFile, setCurrentStep } = useApp();

  // Check if an RTM file has been uploaded to enable the next step
  const hasRtmFile = uploadedFiles.some(file => file.type === 'rtm');

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case 'rtm':
        return 'RTM';
      case 'sequenceDiagram':
        return 'Sequence Diagram';
      case 'classDiagram':
        return 'Class Diagram';
      default:
        return type;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString();
  };
  
  const handleNextStep = () => {
    if (hasRtmFile) {
      setCurrentStep(2); // Go to function selection
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <FileIcon size={20} /> Uploaded Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        {uploadedFiles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploadedFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.name}</TableCell>
                  <TableCell>{getFileTypeLabel(file.type)}</TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatTimestamp(file.timestamp)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 size={16} className="mr-1" />
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-10 text-gray-500">
            No files uploaded yet.
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end">
        {hasRtmFile && (
          <Button 
            onClick={handleNextStep}
            className="flex items-center gap-2"
          >
            Continue to Function Selection
            <ArrowRight size={16} />
          </Button>
        )}
        {!hasRtmFile && uploadedFiles.length > 0 && (
          <div className="text-amber-600 text-sm">
            Please upload an RTM file to continue
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
