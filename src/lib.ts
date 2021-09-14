import {
  CLValueBuilder,
  CLTypeBuilder,
  Keys,
  RuntimeArgs,
  CasperClient,
  CLString,
  CLValue,
  DeployUtil,
} from "casper-js-sdk";

import { IContractCallParams } from "./types";
import * as utils from "./utils";

export const toCLMap = (map: Map<string, string>) => {
  const clMap = CLValueBuilder.map([
    CLTypeBuilder.string(),
    CLTypeBuilder.string(),
  ]);
  for (const [key, value] of Array.from(map.entries())) {
    clMap.set(CLValueBuilder.string(key), CLValueBuilder.string(value));
  }
  return clMap;
};

const fromCLMap = (map: Map<CLString, CLString>) => {
  const jsMap = new Map();
  for (const [key, value] of Array.from(map.entries())) {
    jsMap.set(key.value(), value.value());
  }
  return jsMap;
};

export const installContract = async (
  chainName: string,
  nodeAddress: string,
  keys: Keys.AsymmetricKey,
  runtimeArgs: RuntimeArgs,
  paymentAmount: string,
  wasmPath: string
) => {
  const deployHash = await utils.installWasmFile({
    chainName,
    paymentAmount,
    nodeAddress,
    keys,
    pathToContract: wasmPath,
    runtimeArgs,
  });

  if (deployHash !== null) {
    return deployHash;
  } else {
    throw Error("Problem with installation");
  }
};

export const setClient = async (
  nodeAddress: string,
  contractHash: string,
  listOfNamedKeys: string[]
) => {
  const stateRootHash = await utils.getStateRootHash(nodeAddress);
  const contractData = await utils.getContractData(
    nodeAddress,
    stateRootHash,
    contractHash
  );

  const { contractPackageHash, namedKeys } = contractData.Contract!;

  const namedKeysParsed = namedKeys.reduce((acc, val) => {
    if (listOfNamedKeys.includes(val.name)) {
      return { ...acc, [utils.camelCased(val.name)]: val.key };
    }
    return acc;
  }, {});

  return {
    contractPackageHash,
    namedKeys: namedKeysParsed,
  };
};

export const contractSimpleGetter = async (
  nodeAddress: string,
  contractHash: string,
  key: string[]
) => {
  const stateRootHash = await utils.getStateRootHash(nodeAddress);
  const clValue = await utils.getContractData(
    nodeAddress,
    stateRootHash,
    contractHash,
    key
  );

  if (clValue && clValue.CLValue instanceof CLValue) {
    return clValue.CLValue!.value();
  } else {
    throw Error("Invalid stored value");
  }
};

export const contractCallFn = async ({
  nodeAddress,
  keys,
  chainName,
  contractHash,
  entryPoint,
  runtimeArgs,
  paymentAmount,
  ttl,
}: IContractCallParams) => {
  const client = new CasperClient(nodeAddress);
  const contractHashAsByteArray = utils.contractHashToByteArray(contractHash);

  let deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(keys.publicKey, chainName, 1, ttl),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHashAsByteArray,
      entryPoint,
      runtimeArgs
    ),
    DeployUtil.standardPayment(paymentAmount)
  );

  // Sign deploy.
  deploy = client.signDeploy(deploy, keys);

  // Dispatch deploy to node.
  const deployHash = await client.putDeploy(deploy);

  return deployHash;
};
