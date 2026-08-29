import React from 'react';
import { TbRobot } from 'react-icons/tb';

// Single source of truth for the AI-tutor mark. Swap the import here to
// rebrand every "AI" affordance across the app at once.
function AiIcon(props) {
  return <TbRobot aria-label="CodeSquareAgent" {...props} />;
}

export default AiIcon;
