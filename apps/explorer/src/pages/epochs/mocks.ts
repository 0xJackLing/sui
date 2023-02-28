// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

export type Epoch = {
    // epoch: number;
    // validators: any;
    // transactionCount: number;
    // checkpointSet: [number, number];
    // startTimestamp: number;
    endTimestamp: number;
    totalRewards: number;
    // stakeSubsidies: number;
    storageFundEarnings: number;
    storageSize: number;
    gasCostSummary?: {
        gasRevenue: number;
        totalRevenue: number;
        storageRevenue: number;
        stakeRewards: number;
    };
};

export const getFutureTime = () => {
    const now = new Date(); // get the current time
    const min = now.getTime(); // get the current timestamp in milliseconds
    const max = now.getTime() + 1 * 24 * 60 * 60 * 1000; // set the maximum timestamp to 7 days from now
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const getMockEpochData = (): Epoch => ({
    storageSize: 1000,
    endTimestamp: getFutureTime(),
    gasCostSummary: {
        gasRevenue: 1000000,
        storageRevenue: 1000000,
        stakeRewards: 1000000,
        totalRevenue: 1000000,
    },
    storageFundEarnings: 1000000,
    totalRewards: 1000000,
});

export const getEpochs = async () =>
    Promise.all(Array.from({ length: 20 }).map(getMockEpochData));

// getCheckpoints()
export const getCheckpoints = async () =>
    Promise.all(Array.from({ length: 20 }).map(getCheckpoint));

// getCheckpoint()
export const getCheckpoint = async () => ({
    epoch: 0,
    timestampMs: getFutureTime(),
    sequence_number: 50000,
    network_total_transactions: 10000,
    content_digest: 'J2ERuhiokCicsQVfgs7bZRqkGmZtSoDtL7yNRH6AXtBd',
    signature: 'J2ERuhiokCicsQVfgs7bZRqkGmZtSoDtL7yNRH6AXtBd',
    previous_digest: 'J2ERuhiokCicsQVfgs7bZRqkGmZtSoDtL7yNRH6AXtBd',
    epoch_rolling_gas_cost_summary: {
        computation_cost: 10000,
        storage_cost: 100000,
        storage_rebate: 100000,
    },
    transaction_count: 1000000,
    transactions: [],
});
