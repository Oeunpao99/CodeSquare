import React from 'react';
import {
  TbBinaryTree, TbChartHistogram, TbSparkles, TbBrandHtml5, TbServer2, TbScript,
  TbNetwork,
} from 'react-icons/tb';
import { FiCompass } from 'react-icons/fi';
import { MAJORS } from '../majors';

const ICONS = {
  TbBinaryTree, TbChartHistogram, TbSparkles, TbBrandHtml5, TbServer2, TbScript,
  TbNetwork,
};

// Renders a major's icon by its config key (or a raw Tabler name).
function MajorIcon({ major, name, brand = false, style, ...rest }) {
  const iconName = name || MAJORS[major]?.icon;
  const Icon = ICONS[iconName] || FiCompass;
  const color = brand ? MAJORS[major]?.color : undefined;
  return <Icon style={{ color, ...style }} {...rest} />;
}

export default MajorIcon;
