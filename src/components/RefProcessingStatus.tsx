
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, GitBranch } from 'lucide-react';

interface RefProcessingStatusProps {
  references: Array<{
    id: string;
    name: string;
    diagramName?: string;
    found: boolean;
  }>;
  generatedStubs: string[];
}

export default function RefProcessingStatus({ references, generatedStubs }: RefProcessingStatusProps) {
  const foundRefs = references.filter(ref => ref.found);
  const missingRefs = references.filter(ref => !ref.found);

  if (references.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <GitBranch size={18} />
          REF Box Processing Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {foundRefs.length > 0 && (
          <div>
            <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
              <CheckCircle size={16} />
              Found References ({foundRefs.length})
            </h4>
            <div className="space-y-2">
              {foundRefs.map(ref => (
                <div key={ref.id} className="flex items-center justify-between bg-green-50 p-2 rounded">
                  <span className="text-sm">{ref.name}</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    → {ref.diagramName}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {missingRefs.length > 0 && (
          <div>
            <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
              <XCircle size={16} />
              Missing References ({missingRefs.length})
            </h4>
            <div className="space-y-2">
              {missingRefs.map(ref => (
                <div key={ref.id} className="flex items-center justify-between bg-red-50 p-2 rounded">
                  <span className="text-sm">{ref.name}</span>
                  <Badge variant="destructive">
                    Missing: {ref.diagramName || 'Unknown'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedStubs.length > 0 && (
          <div>
            <h4 className="font-medium text-blue-700 mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              Additional Stubs Generated ({generatedStubs.length})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {generatedStubs.map((stub, idx) => (
                <Badge key={idx} variant="outline" className="justify-center">
                  {stub}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
