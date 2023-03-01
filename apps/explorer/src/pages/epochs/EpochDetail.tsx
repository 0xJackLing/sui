// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { useFeature, useGrowthBook } from '@growthbook/growthbook-react';
import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';

import { validatorsTableData } from '../validators/Validators';
import { getMockEpochData } from './mocks';
import { EpochStats } from './stats/EpochStats';
import { useCheckpointsTable } from './useCheckpointsTable';

import { StatsWrapper } from '~/components/HomeMetrics';
import { SuiAmount } from '~/components/transaction-card/TxCardUtils';
import { useGetCurrentEpochStaticInfo } from '~/hooks/useGetObject';
import { useGetValidatorsEvents } from '~/hooks/useGetValidatorsEvents';
import { EpochProgress } from '~/pages/epochs/stats/Progress';
import { LoadingSpinner } from '~/ui/LoadingSpinner';
import { TableCard } from '~/ui/TableCard';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '~/ui/Tabs';
import { GROWTHBOOK_FEATURES } from '~/utils/growthbook';

function EpochDetail() {
    const enabled = useFeature(GROWTHBOOK_FEATURES.EPOCHS_CHECKPOINTS).on;
    const { data: epochData, isLoading } = useGetCurrentEpochStaticInfo();
    const numberOfValidators = useMemo(
        () => epochData?.validators.active_validators.length || null,
        [epochData]
    );
    const { data: checkpointsTable } = useCheckpointsTable(epochData?.epoch);
    const {
        data: validatorEvents,
        isLoading: validatorsEventsLoading,
        isError: validatorEventError,
    } = useGetValidatorsEvents({
        limit: epochData?.validators.active_validators.length ?? 0,
        order: 'descending',
    });

    // console.log(validatorsTable);
    if (isLoading) return <LoadingSpinner />;
    if (!enabled) return <Navigate to="/" />;
    if (!epochData) return null;

    const validatorsTable = validatorsTableData(
        epochData?.validators.active_validators,
        epochData?.epoch!,
        validatorEvents?.data!
    );
    // todo: remove this when we have this data in the api
    const {
        storageSize,
        gasCostSummary,
        endTimestamp,
        totalRewards,
        storageFundEarnings,
    } = getMockEpochData();

    return (
        <div className="flex flex-col space-y-16">
            <div className="grid grid-cols-1 gap-4 sm:gap-4 md:flex md:gap-6">
                <EpochProgress
                    epoch={epochData.epoch}
                    start={epochData.epoch_start_timestamp_ms!}
                    end={endTimestamp}
                />
                <EpochStats label="Activity">
                    <StatsWrapper label="Storage Size" tooltip="Storage Size">
                        {`${storageSize.toFixed(2)} GB`}
                    </StatsWrapper>
                    <StatsWrapper label="Gas Revenue" tooltip="Gas Revenue">
                        <SuiAmount amount={gasCostSummary?.gasRevenue} />
                    </StatsWrapper>
                    <StatsWrapper
                        label="Storage Revenue"
                        tooltip="Storage Revenue"
                    >
                        <SuiAmount amount={gasCostSummary?.storageRevenue} />
                    </StatsWrapper>
                    <StatsWrapper label="Stake Rewards" tooltip="Stake Rewards">
                        <SuiAmount amount={gasCostSummary?.stakeRewards} />
                    </StatsWrapper>
                </EpochStats>
                <EpochStats label="Rewards">
                    <StatsWrapper
                        label="Stake Subsidies"
                        tooltip="Stake Subsidies"
                    >
                        <SuiAmount
                            amount={epochData.stake_subsidy.balance.value}
                        />
                    </StatsWrapper>
                    <StatsWrapper label="Total Rewards" tooltip="Total Rewards">
                        <SuiAmount amount={totalRewards} />
                    </StatsWrapper>

                    <StatsWrapper
                        label="Storage Fund Earnings"
                        tooltip="Storage Fund Earnings"
                    >
                        <SuiAmount amount={storageFundEarnings} />
                    </StatsWrapper>
                </EpochStats>
            </div>
            <div>
                <TabGroup size="lg">
                    <TabList>
                        <Tab>Checkpoints</Tab>
                        <Tab>Validators</Tab>
                    </TabList>
                    <TabPanels className="mt-4">
                        <TabPanel>
                            {checkpointsTable ? (
                                <TableCard
                                    data={checkpointsTable?.data}
                                    columns={checkpointsTable?.columns}
                                />
                            ) : null}
                        </TabPanel>
                        <TabPanel>
                            {validatorsTable ? (
                                <TableCard
                                    data={checkpointsTable?.data}
                                    columns={checkpointsTable?.columns}
                                />
                            ) : null}
                        </TabPanel>
                    </TabPanels>
                </TabGroup>
            </div>
        </div>
    );
}

export default () => {
    const gb = useGrowthBook();

    if (gb?.ready) {
        return <EpochDetail />;
    }
    return <LoadingSpinner />;
};
