
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileType } from '@/lucide-react';
import { Trash2 } from 'lucide-react';

export default function FileManager() {
  const { uploadedFiles, removeFile } = useApp();

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <FileType size={20} /> Uploaded Files
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
    </Card>
  );
}
