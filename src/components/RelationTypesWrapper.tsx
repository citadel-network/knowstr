import React from "react";
import { useNavigate } from "react-router-dom";
import { planUpdateRelationTypes, usePlanner } from "../planner";
import { RelationTypes, useGetAllRelationTypes } from "./RelationTypes";

export function RelationTypesWrapper(): JSX.Element {
  const navigate = useNavigate();
  const { createPlan, executePlan } = usePlanner();
  const allRelationTypes = useGetAllRelationTypes();
  const submit = async (relationTypeState: RelationTypes): Promise<void> => {
    const plan = planUpdateRelationTypes(createPlan(), relationTypeState);
    await executePlan(plan);
    navigate("/");
  };

  return <RelationTypes relationTypes={allRelationTypes} onSubmit={submit} />;
}
