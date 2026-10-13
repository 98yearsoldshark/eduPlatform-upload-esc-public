import React, { useState, useEffect } from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface KatexRendererProps {
  formula: string;
  displayMode?: 'inline' | 'block' | 'both';
  onError?: (error: string) => void;
}

const KatexRenderer: React.FC<KatexRendererProps> = ({ 
  formula, 
  displayMode = 'both',
  onError 
}) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 重置错误状态
    setError(null);
  }, [formula]);

  const handleError = (err: Error) => {
    const errorMessage = err.message;
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
  };

  const renderInlineMath = () => {
    try {
      return <InlineMath errorColor="#cc0000" strict={false}>{formula}</InlineMath>;
    } catch (err) {
      if (err instanceof Error) {
        handleError(err);
      }
      return <span className="text-red-500">行内公式渲染失败</span>;
    }
  };

  const renderBlockMath = () => {
    try {
      return <BlockMath errorColor="#cc0000" strict={false}>{formula}</BlockMath>;
    } catch (err) {
      if (err instanceof Error) {
        handleError(err);
      }
      return <span className="text-red-500">块级公式渲染失败</span>;
    }
  };

  return (
    <div className="katex-renderer">
      {error && (
        <div className="text-red-500 mb-2 text-sm">
          <p>渲染错误: {error}</p>
          <p>请检查LaTeX语法是否正确</p>
        </div>
      )}
      
      {displayMode === 'inline' || displayMode === 'both' ? (
        <div className="mb-4">
          {displayMode === 'both' && <h3 className="text-md font-semibold">行内公式:</h3>}
          <div className="p-4 bg-gray-50 rounded">
            {renderInlineMath()}
          </div>
        </div>
      ) : null}
      
      {displayMode === 'block' || displayMode === 'both' ? (
        <div className="mb-4">
          {displayMode === 'both' && <h3 className="text-md font-semibold">块级公式:</h3>}
          <div className="p-4 bg-gray-50 rounded">
            {renderBlockMath()}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KatexRenderer;