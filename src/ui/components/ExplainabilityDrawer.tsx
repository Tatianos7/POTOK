import type { BaseExplainabilityDTO } from '../../types/explainability';
import ExplainabilityDrawerBase from '../../components/ExplainabilityDrawer';

interface ExplainabilityDrawerProps {
  explainability?: BaseExplainabilityDTO | null;
}

const ExplainabilityDrawer = ({ explainability }: ExplainabilityDrawerProps) => {
  return <ExplainabilityDrawerBase explainability={explainability} />;
};

export default ExplainabilityDrawer;
