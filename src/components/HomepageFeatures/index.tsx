import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Extremely Fast Cycle-Accurate Simulation',
    description: (
      <>
        State-of-the-art simulation speed with precise cycle-accurate modeling 
        of neural network accelerators for realistic performance estimates.
      </>
    ),
  },
  {
    title: 'Heterogeneous Compute Units Support',
    description: (
      <>
        Support for heterogeneous systolic arrays and vector units modeled as 
        state machines interacting with job scheduler and memory 
        systems via DRAMSim3.
      </>
    ),
  },
  {
    title: 'Comprehensive Layer Support for modern ML models',
    description: (
      <>
        Full coverage of modern ML workloads including matrix operations (GEMMs, Convolutions), activation functions, and normalization layers.
      </>
    ),
  },
];

function Feature({title, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
