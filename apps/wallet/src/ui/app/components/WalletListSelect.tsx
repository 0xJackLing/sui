// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { cx } from 'class-variance-authority';
import { useMemo } from 'react';

import { useAccounts } from '../hooks/useAccounts';
import { useDeriveNextAccountMutation } from '../hooks/useDeriveNextAccountMutation';
import { Link } from '../shared/Link';
import { SummaryCard } from './SummaryCard';
import {
    WalletListSelectItem,
    type WalletListSelectItemProps,
} from './WalletListSelectItem';

export type WalletListSelectProps = {
    title: string;
    values: string[];
    visibleValues?: string[];
    mode?: WalletListSelectItemProps['mode'];
    disabled?: boolean;
    onChange: (values: string[]) => void;
};

export function WalletListSelect({
    title,
    values,
    visibleValues,
    mode = 'select',
    disabled = false,
    onChange,
}: WalletListSelectProps) {
    const accounts = useAccounts();
    const filteredAccounts = useMemo(() => {
        if (visibleValues) {
            return accounts.filter(({ address }) =>
                visibleValues.includes(address)
            );
        }
        return accounts;
    }, [accounts, visibleValues]);
    const deriveNextAccount = useDeriveNextAccountMutation();
    return (
        <SummaryCard
            header={title}
            body={
                <ul
                    className={cx(
                        'flex flex-col items-stretch flex-1 p-0 m-0 self-stretch list-none',
                        disabled ? 'opacity-70' : ''
                    )}
                >
                    {filteredAccounts.map(({ address }) => (
                        <li
                            key={address}
                            onClick={() => {
                                if (disabled) {
                                    return;
                                }
                                const newValues = [];
                                let found = false;
                                for (const anAddress of values) {
                                    if (anAddress === address) {
                                        found = true;
                                        continue;
                                    }
                                    newValues.push(anAddress);
                                }
                                if (!found) {
                                    newValues.push(address);
                                }
                                onChange(newValues);
                            }}
                        >
                            <WalletListSelectItem
                                address={address}
                                selected={values.includes(address)}
                                mode={mode}
                                disabled={disabled}
                                isNew={deriveNextAccount.data === address}
                            />
                        </li>
                    ))}
                </ul>
            }
            footer={
                mode === 'select' ? (
                    <div className="flex flex-row flex-nowrap self-stretch justify-between">
                        <div>
                            <Link
                                color="heroDark"
                                weight="medium"
                                text="Select all"
                                disabled={disabled}
                                onClick={() =>
                                    onChange(
                                        filteredAccounts.map(
                                            ({ address }) => address
                                        )
                                    )
                                }
                            />
                        </div>
                        <div>
                            <Link
                                color="heroDark"
                                weight="medium"
                                text="New account"
                                disabled={disabled}
                                loading={deriveNextAccount.isLoading}
                                onClick={async () => {
                                    const newAccountAddress =
                                        await deriveNextAccount.mutateAsync();
                                    if (
                                        !visibleValues ||
                                        visibleValues.includes(
                                            newAccountAddress
                                        )
                                    ) {
                                        onChange([
                                            ...values,
                                            newAccountAddress,
                                        ]);
                                    }
                                }}
                            />
                        </div>
                    </div>
                ) : null
            }
            minimalPadding
        />
    );
}
