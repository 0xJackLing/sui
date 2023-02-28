import { UnserializedSignableTransaction } from '../signers/txn-data-serializers/txn-data-serializer';
import { Transaction, Commands } from './';

/**
 * Attempts to convert from a legacy UnserailizedSignableTransaction, into a
 * Programmable Transaction using the transaction builder. This should only be
 * used as a compatibility layer, and will be removed in a future release.
 *
 * @deprecated Use `Transaction` instead.
 */
export function convertToTransactionBuilder({
  kind,
  data,
}: UnserializedSignableTransaction) {
  const tx = new Transaction();
  switch (kind) {
    case 'mergeCoin':
      tx.add(
        Commands.Merge(tx.createInput(data.primaryCoin), [
          tx.createInput(data.coinToMerge),
        ]),
      );
      break;
    case 'paySui':
      data.recipients.forEach((recipient, index) => {
        const amount = data.amounts[index];
        const coin = tx.add(Commands.Split(tx.gas(), tx.createInput(amount)));
        tx.add(Commands.TransferObjects(coin, tx.createInput(recipient)));
      });
      tx.setGasPayment(data.inputCoins);
      break;
    case 'transferObject':
      tx.add(
        Commands.TransferObjects(
          [tx.createInput(data.objectId)],
          tx.createInput(data.recipient),
        ),
      );
      break;
    case 'payAllSui':
      tx.add(
        Commands.TransferObjects([tx.gas()], tx.createInput(data.recipient)),
      );
      tx.setGasPayment(data.inputCoins);
      break;
    case 'splitCoin':
      data.splitAmounts.forEach((amount) => {
        tx.add(
          Commands.Split(
            tx.createInput(data.coinObjectId),
            tx.createInput(amount),
          ),
        );
      });
      break;
    case 'moveCall':
    case 'publish':
    case 'pay':
    case 'transferSui':
      throw new Error('Kind not yet implemeneted');
    default:
      throw new Error(`Unknown transaction kind: "${kind}"`);
  }

  if ('gasPayment' in data) {
    tx.setGasPayment(data.gasPayment);
  }
  if (data.gasBudget) {
    tx.setGasBudget(data.gasBudget);
  }
  if (data.gasPrice) {
    tx.setGasPrice(data.gasPrice);
  }

  return tx;
}
