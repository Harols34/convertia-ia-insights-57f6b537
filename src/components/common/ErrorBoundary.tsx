import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || "Component"}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-rose-500" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-sm font-bold text-slate-900">Algo salió mal en esta sección</h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              Hubo un error al renderizar {this.props.name || "este componente"}. Puedes intentar recargar la sección.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={this.handleReset}
            className="h-8 text-[10px] gap-2 border-slate-200"
          >
            <RefreshCcw className="h-3 w-3" />
            Reintentar
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
